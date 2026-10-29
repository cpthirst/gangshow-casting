// `pnpm release`: merges the release-please pull request, waits for its tag, then deploys
// that tag from here with your own AWS profile, as docs/guides/hosting.md section 4 does by
// hand. It merges with your admin bypass of the ruleset on main, as a release PR never gets
// the CI checks the ruleset requires (GitHub starts none for a PR made with GITHUB_TOKEN).
// `pnpm release v0.1.0` deploys a version without merging anything, to redeploy or go
// back. It asks before it merges and before it deploys, and it won't deploy a diff that would
// replace the table or the user pool. For the maintainer only: it uses your real AWS account.
// Every step that matters stops the release if it fails, so it never deploys a different
// version, or a diff it couldn't read, by accident.
import { execFileSync, spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";

interface RunOptions {
  env?: Record<string, string>;
  /** What to keep of the command's output: its stdout (the default), stdout and stderr
   *  together (a `cdk diff` prints to either), or none, leaving the command the terminal
   *  itself (a deploy's progress and approval prompts, the check's hidden password prompt). */
  output?: "stdout" | "both" | "none";
}

export interface ReleaseDeps {
  env: Record<string, string | undefined>;
  print: (line: string) => void;
  /** Asks a yes/no question; anything but yes is no. */
  ask: (question: string) => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
  /** Runs a command on the terminal, also keeping what it printed. */
  run: (
    command: string,
    args: string[],
    options?: RunOptions,
  ) => Promise<{ code: number; output: string }>;
}

const STACK = "GangshowCasting";
const REGION = "eu-west-2";
const RELEASE_BRANCH = "release-please--";
const TAG_POLLS = 30;
const TAG_POLL_MS = 10_000;

interface PullRequest {
  number: number;
  title: string;
  headRefName: string;
  author: { login: string };
}

/** The open release-please pull request, if there is one: its title and its branch both say
 *  so, because anyone can open a pull request with a title that does.
 *  Input: `gh pr list --json number,title,headRefName,author`. */
export function releasePullRequest(json: string): PullRequest | undefined {
  const open: PullRequest[] = JSON.parse(json);
  return open.find(
    (pr) =>
      pr.title.startsWith("chore(main): release ") && pr.headRefName.startsWith(RELEASE_BRANCH),
  );
}

/** The release tags (`v1.2.3`) in a `git tag --list`, lowest version first. */
export const releaseTags = (tags: string) =>
  tags
    .split("\n")
    .map((tag) => tag.trim())
    .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

/** The highest release tag, by number: v0.10.0 is after v0.9.1. */
export const newestReleaseTag = (tags: string) => releaseTags(tags).at(-1);

// A diff can carry colour codes if the environment forces them: read it without.
// biome-ignore lint/suspicious/noControlCharactersInRegex: the escape character is the point.
const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

const RESOURCE = /^\s*\[[-+~]\]\s+AWS::/;
// The stack's TableV2 is a GlobalTable in CloudFormation. Only the files bucket is listed:
// the pages' bucket holds nothing a deploy can't rebuild.
const STATEFUL = /AWS::(DynamoDB::(Global)?Table|Cognito::UserPool|S3::Bucket FilesBucket)\s/;
const REMOVED_OR_REPLACED = /\b(destroy|replace|orphan)\b|requires replacement/;

/** The resources a `cdk diff` would remove or replace, as their lines, in a block per
 *  resource: its own line and the property lines under it. */
function removedOrReplaced(diff: string) {
  const blocks: string[][] = [];
  for (const line of plain(diff).split("\n")) {
    if (RESOURCE.test(line)) blocks.push([line]);
    else blocks.at(-1)?.push(line);
  }
  return blocks.filter((block) => block.some((line) => REMOVED_OR_REPLACED.test(line)));
}

/** The table, user pool or files bucket lines of a `cdk diff` that would destroy, replace or
 *  orphan them: they hold the show, the accounts and the scenery files (hosting guide, section
 *  1; ADR 0030). A user pool's client or group is not the pool, nor a bucket's policy the bucket. Re-check this against real `cdk diff` output after a CDK upgrade. */
export const statefulResourceRisks = (diff: string) =>
  removedOrReplaced(diff)
    .filter((block) => STATEFUL.test(block[0] ?? ""))
    .map((block) => block[0] ?? "");

/** Every resource line a diff would remove or replace, for the maintainer to read. */
export const removedOrReplacedLines = (diff: string) =>
  removedOrReplaced(diff).map((block) => block[0] ?? "");

/** A diff that ran: it names the stack, or says nothing differs. */
const looksLikeDiff = (output: string) =>
  /Stack GangshowCasting|There were no differences/.test(plain(output));

/** A stack's outputs by key, from `describe-stacks --query "Stacks[0].Outputs"`. */
export function stackOutputs(json: string) {
  const outputs: { OutputKey: string; OutputValue: string }[] = JSON.parse(json);
  return Object.fromEntries(outputs.map(({ OutputKey, OutputValue }) => [OutputKey, OutputValue]));
}

/** Runs a command and says whether it worked, telling the maintainer if it didn't. */
async function succeeds(deps: ReleaseDeps, command: string, args: string[], why: string) {
  const { code } = await deps.run(command, args, { output: "none" });
  if (code !== 0) deps.print(`${why} Nothing further was done.`);
  return code === 0;
}

export async function release([version]: string[], deps: ReleaseDeps) {
  const { env, print, run } = deps;
  if (!env.ALERT_EMAIL || !env.AWS_PROFILE) {
    print("Set ALERT_EMAIL and AWS_PROFILE first, as the hosting guide's section 4 does.");
    return 1;
  }
  const dirty = await run("git", ["status", "--porcelain"]);
  if (dirty.code !== 0 || dirty.output.trim() !== "") {
    print(
      "Commit or stash your changes first (or this isn't a git repository): releasing switches branches.",
    );
    return 1;
  }
  // Before anything is merged, so a wrong or expired profile stops the release at the start.
  const who = await run("aws", [
    "sts",
    "get-caller-identity",
    "--query",
    "Account",
    "--output",
    "text",
  ]);
  const account = who.output.trim();
  if (who.code !== 0 || account === "") {
    print(`Couldn't sign in to AWS with the profile ${env.AWS_PROFILE}. Nothing further was done.`);
    return 1;
  }

  try {
    if (!(await succeeds(deps, "git", ["switch", "main"], "Couldn't switch to main."))) return 1;
    if (!(await succeeds(deps, "git", ["pull", "--ff-only"], "Couldn't bring main up to date.")))
      return 1;
    if (!(await succeeds(deps, "git", ["fetch", "--tags"], "Couldn't fetch the tags."))) return 1;
    return await releaseFrom(version, account, deps);
  } finally {
    await run("git", ["switch", "main"]);
  }
}

async function releaseFrom(requested: string | undefined, account: string, deps: ReleaseDeps) {
  const { print, ask, run } = deps;
  let tag = requested;

  if (tag === undefined) {
    const before = newestReleaseTag((await run("git", ["tag", "--list", "v*"])).output);
    const list = await run("gh", [
      "pr",
      "list",
      "--state",
      "open",
      "--json",
      "number,title,headRefName,author",
    ]);
    const pr = list.code === 0 ? releasePullRequest(list.output) : undefined;
    if (!pr) {
      print("No release pull request is open: nothing to release.");
      print("To redeploy a version, or go back to one, give it: pnpm release v0.1.0");
      return 0;
    }
    if (
      !(await ask(
        `Merge "${pr.title}" (#${pr.number}, by ${pr.author.login}) with your admin bypass, and deploy it?`,
      ))
    )
      return 0;
    if (
      !(await succeeds(
        deps,
        "gh",
        ["pr", "merge", String(pr.number), "--squash", "--admin"],
        "The merge failed, so nothing was merged or deployed.",
      ))
    )
      return 1;
    tag = await waitForNewTag(before, deps);
    if (tag === undefined) {
      print(
        "The release is merged but its tag hasn't appeared yet. Once it has: pnpm release <version>",
      );
      return 1;
    }
    if (before !== undefined) {
      print(`The version you're replacing is ${before}. To go back to it: pnpm release ${before}`);
    }
  } else if (!releaseTags((await run("git", ["tag", "--list", "v*"])).output).includes(tag)) {
    print(`${tag} isn't a release tag. The tags are: git tag --list 'v*'`);
    return 1;
  } else if (!(await ask(`Deploy ${tag}?`))) {
    return 0;
  }
  return deploy(tag, account, deps);
}

/** The release's tag, which release-please creates a little after the merge. */
async function waitForNewTag(before: string | undefined, { run, sleep, print }: ReleaseDeps) {
  for (let attempt = 0; attempt < TAG_POLLS; attempt++) {
    // A failed fetch just means another poll, so its result isn't checked.
    await run("git", ["fetch", "--tags"]);
    const newest = newestReleaseTag((await run("git", ["tag", "--list", "v*"])).output);
    if (newest !== undefined && newest !== before) return newest;
    if (attempt === 0) print("Waiting for the release's tag...");
    await sleep(TAG_POLL_MS);
  }
  return undefined;
}

async function deploy(tag: string, account: string, deps: ReleaseDeps) {
  const { print, ask, run } = deps;
  if (!(await succeeds(deps, "git", ["switch", "--detach", tag], `Couldn't switch to ${tag}.`)))
    return 1;
  // Never deploy anything but the tag that was asked for.
  const at = await run("git", ["describe", "--exact-match", "--tags", "HEAD"]);
  if (at.code !== 0 || at.output.trim() !== tag) {
    print(`The code isn't at ${tag}, so it won't be deployed.`);
    return 1;
  }
  if (
    !(await succeeds(
      deps,
      "pnpm",
      ["install", "--frozen-lockfile"],
      "Couldn't install the dependencies.",
    ))
  )
    return 1;

  const diff = await run("pnpm", ["infra:diff"], {
    env: { NO_COLOR: "1", FORCE_COLOR: "0" },
    output: "both",
  });
  if (diff.code !== 0 || !looksLikeDiff(diff.output)) {
    print(
      "Couldn't read the deploy's diff, so the table, user pool and files bucket can't be checked. Not deploying.",
    );
    return 1;
  }
  const risks = statefulResourceRisks(diff.output);
  if (risks.length > 0) {
    print(
      "This deploy would replace or remove the table or the user pool, which hold the show and the accounts:",
    );
    for (const line of risks) print(`  ${line}`);
    print("Not deploying. Ask for help before going further.");
    return 1;
  }
  const removed = removedOrReplacedLines(diff.output);
  if (removed.length > 0) {
    print("Resources this deploy removes or replaces (not the table, user pool or files bucket):");
    for (const line of removed) print(`  ${line}`);
  }
  if (
    !(await ask(
      `That's the diff for ${tag}. Deploy it to AWS account ${account} (profile ${deps.env.AWS_PROFILE})?`,
    ))
  ) {
    return 0;
  }

  if ((await run("pnpm", ["infra:deploy"], { output: "none" })).code !== 0) {
    print(`The deploy failed. Nothing more was done; fix the cause and run: pnpm release ${tag}`);
    return 1;
  }
  if (
    !(await ask(
      "Deployed. Run the post-deploy check now? It asks for the check accounts' passwords.",
    ))
  ) {
    return 0;
  }
  const checked = await runHostedCheck(deps);
  print("Disable the check accounts now (Accounts page), as the hosting guide says.");
  return checked ? 0 : 1;
}

/** Runs the post-deploy check (hosting FR17) from the stack's own outputs. */
async function runHostedCheck({ env, run, print }: ReleaseDeps) {
  const described = await run("aws", [
    "cloudformation",
    "describe-stacks",
    "--stack-name",
    STACK,
    "--region",
    REGION,
    "--query",
    "Stacks[0].Outputs",
    "--output",
    "json",
  ]);
  const outputs = described.code === 0 ? stackOutputs(described.output) : {};
  const { AppUrl, UserPoolId, CheckClientId } = outputs;
  if (!AppUrl || !UserPoolId || !CheckClientId) {
    print(
      "Couldn't read the stack's AppUrl, UserPoolId and CheckClientId, so the check wasn't run.",
    );
    return false;
  }
  const admin = env.CHECK_ADMIN ?? "check-admin";
  const member = env.CHECK_MEMBER ?? "check-member";
  const readOnly = env.CHECK_READ_ONLY ?? "check-read-only";
  const check = await run("pnpm", ["check:hosted", AppUrl, admin, member, readOnly], {
    env: { USER_POOL_ID: UserPoolId, CHECK_CLIENT_ID: CheckClientId },
    output: "none",
  });
  return check.code === 0;
}

/** The real machine: commands run on your terminal, and what they print is kept too. */
function realDeps(): ReleaseDeps {
  return {
    env: process.env,
    print: (line) => process.stdout.write(`${line}\n`),
    ask: (question) =>
      new Promise((resolve) => {
        // Open only while it waits for an answer, so it can't share the terminal with the
        // commands that read it too (the check's hidden password prompt).
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        // Ctrl+C at a question is a no, so the release ends tidily, back on main.
        rl.on("SIGINT", () => {
          rl.close();
          resolve(false);
        });
        rl.question(`${question} (y/N) `).then((answer) => {
          rl.close();
          resolve(/^y(es)?$/i.test(answer.trim()));
        });
      }),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    run: (command, args, options) =>
      new Promise((resolve, reject) => {
        const keep = options?.output ?? "stdout";
        const child = spawn(command, args, {
          env: { ...process.env, ...options?.env },
          // Kept output is piped (and still shown); otherwise the command has the terminal.
          stdio: keep === "none" ? "inherit" : ["inherit", "pipe", "pipe"],
        });
        let output = "";
        child.stdout?.on("data", (chunk: Buffer) => {
          output += chunk;
          process.stdout.write(chunk);
        });
        child.stderr?.on("data", (chunk: Buffer) => {
          if (keep === "both") output += chunk;
          process.stderr.write(chunk);
        });
        child.on("error", reject);
        child.on("close", (code) => resolve({ code: code ?? 1, output }));
      }),
  };
}

if (import.meta.main) {
  // Ctrl+C mid-release shouldn't leave the repo on a detached tag.
  process.on("SIGINT", () => {
    try {
      execFileSync("git", ["switch", "main"], { stdio: "ignore" });
    } finally {
      process.exit(130);
    }
  });
  process.exit(await release(process.argv.slice(2), realDeps()));
}
