import { describe, expect, it } from "vitest";
import {
  newestReleaseTag,
  type ReleaseDeps,
  release,
  releasePullRequest,
  releaseTags,
  removedOrReplacedLines,
  stackOutputs,
  statefulResourceRisks,
} from "./release.ts";

const pr = (number: number, title: string, headRefName: string, login = "app/github-actions") => ({
  number,
  title,
  headRefName,
  author: { login },
});

describe("releasePullRequest", () => {
  it("finds the release-please pull request among the open ones", () => {
    const open = JSON.stringify([
      pr(61, "feat(web): something else", "feat/something"),
      pr(62, "chore(main): release 0.9.0", "release-please--branches--main"),
    ]);

    expect(releasePullRequest(open)?.number).toBe(62);
  });

  it("isn't fooled by a pull request that only has the title", () => {
    const spoofed = JSON.stringify([
      pr(63, "chore(main): release 9.9.9", "feat/sneaky", "someone"),
    ]);

    expect(releasePullRequest(spoofed)).toBeUndefined();
  });

  it("is undefined when none is open", () => {
    expect(releasePullRequest("[]")).toBeUndefined();
  });
});

describe("release tags", () => {
  it("are sorted by number, not by text, and the newest is the highest", () => {
    expect(releaseTags("v0.2.0\nv0.10.0\nv0.9.1\n")).toEqual(["v0.2.0", "v0.9.1", "v0.10.0"]);
    expect(newestReleaseTag("v0.2.0\nv0.10.0\nv0.9.1\n")).toBe("v0.10.0");
  });

  it("ignore anything that isn't a release, and the newest is undefined with none", () => {
    expect(releaseTags("latest\nv1.0.0\nold-thing\nv1.0.0-rc1\n")).toEqual(["v1.0.0"]);
    expect(newestReleaseTag("")).toBeUndefined();
  });
});

describe("what a cdk diff would remove", () => {
  const table = "AWS::DynamoDB::Table DataTable DataTable447BC44E";
  const pool = "AWS::Cognito::UserPool UserPool UserPool6BA7E5F2";

  it.each([
    ["destroyed", `[-] ${table} destroy`],
    ["replaced", `[~] ${table} replace`],
    ["orphaned", `[-] ${table} orphan`],
    ["a user pool replaced", `[~] ${pool} replace`],
  ])("flags a table or user pool that would be %s", (_name, line) => {
    expect(statefulResourceRisks(`Resources\n${line}\n`)).toEqual([line]);
  });

  it("reads a diff that has colour codes", () => {
    const line = `\u001b[31m[-] ${table} destroy\u001b[39m`;

    expect(statefulResourceRisks(`Resources\n${line}\n`)).toEqual([`[-] ${table} destroy`]);
  });

  it("flags a replacement shown only by a property line under the resource", () => {
    const diff = `[~] ${table}\n └─ [~] TableName (requires replacement)\n    ├─ [-] old\n`;

    expect(statefulResourceRisks(diff)).toEqual([`[~] ${table}`]);
  });

  it("allows changes that keep them, and doesn't blame a table for what's under another resource", () => {
    const diff = [
      `[~] ${table}`,
      " └─ [~] DeletionProtectionEnabled",
      "[-] AWS::S3::Bucket Pages PagesAB12 destroy",
      "[+] AWS::Lambda::Function NewFn NewFn1",
    ].join("\n");

    expect(statefulResourceRisks(diff)).toEqual([]);
  });

  it("doesn't mistake a user pool's client or group for the pool", () => {
    const diff = "[-] AWS::Cognito::UserPoolClient WebClient WebClientAB12 destroy\n";

    expect(statefulResourceRisks(diff)).toEqual([]);
  });

  it("lists every resource that would be removed or replaced, to show the maintainer", () => {
    const diff = [
      "[-] AWS::S3::Bucket Pages PagesAB12 destroy",
      `[~] ${table}`,
      "[~] AWS::CloudFront::Distribution Distribution Dist1 replace",
      "[+] AWS::Lambda::Function NewFn NewFn1",
    ].join("\n");

    expect(removedOrReplacedLines(diff)).toEqual([
      "[-] AWS::S3::Bucket Pages PagesAB12 destroy",
      "[~] AWS::CloudFront::Distribution Distribution Dist1 replace",
    ]);
  });
});

describe("stackOutputs", () => {
  it("reads the outputs by key", () => {
    const json = JSON.stringify([
      { OutputKey: "AppUrl", OutputValue: "https://made-up.example/" },
      { OutputKey: "UserPoolId", OutputValue: "eu-west-2_madeup" },
    ]);

    expect(stackOutputs(json)).toEqual({
      AppUrl: "https://made-up.example/",
      UserPoolId: "eu-west-2_madeup",
    });
  });
});

type Reply = { code: number; output: string };

/**
 * A fake machine: it records every command, answers from a script, and says yes or no to
 * questions in turn. `fail` names command lines that exit 1; `reply` overrides a line's answer.
 */
function fakeMachine(
  options: {
    status?: string;
    tagsBefore?: string;
    tagsAfter?: string;
    diff?: string;
    yes?: boolean[];
    fail?: string[];
    reply?: Record<string, Reply>;
    prs?: unknown[];
    env?: Record<string, string | undefined>;
  } = {},
) {
  const commands: string[] = [];
  const printed: string[] = [];
  const asked: string[] = [];
  const checks: { line: string; env: Record<string, string> | undefined }[] = [];
  const optionsOf: Record<string, unknown> = {};
  const yes = [...(options.yes ?? [])];
  let tagLists = 0;
  let checkedOut = "main";
  const deps: ReleaseDeps = {
    env: options.env ?? { ALERT_EMAIL: "made-up@example.com", AWS_PROFILE: "made-up" },
    print: (line) => printed.push(line),
    ask: async (question) => {
      asked.push(question);
      return yes.shift() ?? false;
    },
    sleep: async () => {},
    run: async (command, args, runOptions) => {
      const line = [command, ...args].join(" ");
      commands.push(line);
      optionsOf[line] = runOptions;
      if (line.startsWith("pnpm check:hosted")) checks.push({ line, env: runOptions?.env });
      if (options.fail?.includes(line)) return { code: 1, output: "" };
      const reply = options.reply?.[line];
      if (reply) return reply;
      if (line.startsWith("git switch")) checkedOut = args.at(-1) ?? "";
      const ok = (output: string) => ({ code: 0, output });
      switch (line) {
        case "git status --porcelain":
          return ok(options.status ?? "");
        case "aws sts get-caller-identity --query Account --output text":
          return ok("123456789012\n");
        case "git tag --list v*": {
          tagLists += 1;
          const first = options.tagsBefore ?? "v0.1.0\n";
          return ok(tagLists <= 1 ? first : (options.tagsAfter ?? first));
        }
        case "git describe --exact-match --tags HEAD":
          return ok(`${checkedOut}\n`);
        case "pnpm infra:diff":
          return ok(options.diff ?? "Stack GangshowCasting\nThere were no differences\n");
        case "gh pr list --state open --json number,title,headRefName,author":
          return ok(
            JSON.stringify(
              options.prs ?? [
                pr(62, "chore(main): release 0.2.0", "release-please--branches--main"),
              ],
            ),
          );
        default:
          if (line.startsWith("aws cloudformation describe-stacks")) {
            return ok(
              JSON.stringify([
                { OutputKey: "AppUrl", OutputValue: "https://made-up.example/" },
                { OutputKey: "UserPoolId", OutputValue: "eu-west-2_madeup" },
                { OutputKey: "CheckClientId", OutputValue: "made-up-client" },
              ]),
            );
          }
          return ok("");
      }
    },
  };
  return { deps, commands, printed, asked, checks, optionsOf };
}

const merged = { tagsBefore: "v0.1.0\n", tagsAfter: "v0.1.0\nv0.2.0\n" };
const didNotDeploy = (commands: string[]) => expect(commands).not.toContain("pnpm infra:deploy");
const endedOnMain = (commands: string[]) => expect(commands.at(-1)).toBe("git switch main");

describe("release: before anything changes", () => {
  it("won't start without the alert email and AWS profile, touching nothing", async () => {
    const { deps, commands, printed } = fakeMachine({ env: {} });

    expect(await release([], deps)).toBe(1);
    expect(commands).toEqual([]);
    expect(printed.join("\n")).toContain("ALERT_EMAIL");
  });

  it("won't start with uncommitted changes", async () => {
    const { deps, commands } = fakeMachine({ status: " M apps/web/src/App.vue\n" });

    expect(await release([], deps)).toBe(1);
    expect(commands).not.toContain("git switch main");
  });

  it("won't start if git can't say whether the tree is clean", async () => {
    const { deps, commands } = fakeMachine({ fail: ["git status --porcelain"] });

    expect(await release([], deps)).toBe(1);
    expect(commands).not.toContain("git switch main");
  });

  it("stops before merging anything if it can't sign in to AWS", async () => {
    const { deps, commands, printed } = fakeMachine({
      fail: ["aws sts get-caller-identity --query Account --output text"],
    });

    expect(await release([], deps)).toBe(1);
    expect(commands.some((c) => c.startsWith("gh pr"))).toBe(false);
    expect(commands).not.toContain("git switch main");
    expect(printed.join("\n")).toContain("sign in to AWS");
  });

  it.each([
    ["switch to main", "git switch main"],
    ["bring main up to date", "git pull --ff-only"],
    ["fetch the tags", "git fetch --tags"],
  ])("stops, merging nothing, if it can't %s", async (_name, failing) => {
    const { deps, commands } = fakeMachine({ fail: [failing], yes: [true, true] });

    expect(await release([], deps)).toBe(1);
    expect(commands.some((c) => c.startsWith("gh pr merge"))).toBe(false);
    didNotDeploy(commands);
    endedOnMain(commands);
  });
});

describe("release: merging", () => {
  it("says so, and changes nothing, when no release pull request is open", async () => {
    const { deps, commands, printed } = fakeMachine({ prs: [] });

    expect(await release([], deps)).toBe(0);
    expect(commands.some((c) => c.startsWith("gh pr merge"))).toBe(false);
    didNotDeploy(commands);
    expect(printed.join("\n")).toContain("No release pull request is open");
  });

  it("won't merge a pull request that only looks like the release", async () => {
    const { deps, commands } = fakeMachine({
      prs: [pr(63, "chore(main): release 9.9.9", "feat/sneaky", "someone")],
      yes: [true],
    });

    expect(await release([], deps)).toBe(0);
    expect(commands.some((c) => c.startsWith("gh pr merge"))).toBe(false);
  });

  it("names the pull request and who opened it when it asks", async () => {
    const { deps, asked } = fakeMachine({ yes: [false] });

    await release([], deps);

    expect(asked[0]).toContain("chore(main): release 0.2.0");
    expect(asked[0]).toContain("#62");
    expect(asked[0]).toContain("app/github-actions");
  });

  it("merges with the admin bypass, and says so, since a release PR never gets the checks the ruleset requires", async () => {
    const { deps, commands, asked } = fakeMachine({ yes: [true, false], ...merged });

    await release([], deps);

    expect(commands).toContain("gh pr merge 62 --squash --admin");
    expect(asked[0]).toContain("bypass");
  });

  it("stops when you say no to merging", async () => {
    const { deps, commands } = fakeMachine({ yes: [false] });

    expect(await release([], deps)).toBe(0);
    expect(commands.some((c) => c.startsWith("gh pr merge"))).toBe(false);
    endedOnMain(commands);
  });

  it("stops, deploying nothing, if the merge fails", async () => {
    const { deps, commands, printed } = fakeMachine({
      yes: [true],
      fail: ["gh pr merge 62 --squash --admin"],
    });

    expect(await release([], deps)).toBe(1);
    didNotDeploy(commands);
    expect(printed.join("\n")).toContain("nothing was merged or deployed");
    endedOnMain(commands);
  });

  it("gives up with a way forward if the release tag never appears", async () => {
    const { deps, commands, printed } = fakeMachine({ yes: [true], tagsBefore: "v0.1.0\n" });

    expect(await release([], deps)).toBe(1);
    didNotDeploy(commands);
    expect(printed.join("\n")).toContain("pnpm release <version>");
  });
});

describe("release: deploying", () => {
  it("merges, waits for the tag, deploys exactly that tag, and returns to main", async () => {
    const { deps, commands, printed } = fakeMachine({ yes: [true, true, false], ...merged });

    expect(await release([], deps)).toBe(0);

    const steps = [
      "gh pr merge 62 --squash --admin",
      "git switch --detach v0.2.0",
      "git describe --exact-match --tags HEAD",
      "pnpm install --frozen-lockfile",
      "pnpm infra:diff",
      "pnpm infra:deploy",
    ];
    const seen = commands.filter((c) => steps.includes(c));
    expect(seen).toEqual(steps);
    endedOnMain(commands);
    expect(printed.join("\n")).toContain("pnpm release v0.1.0");
  });

  it("reads the diff without colour, from both output streams", async () => {
    const { deps, optionsOf } = fakeMachine({ yes: [true, false], ...merged });

    await release([], deps);

    expect(optionsOf["pnpm infra:diff"]).toEqual({
      env: { NO_COLOR: "1", FORCE_COLOR: "0" },
      output: "both",
    });
  });

  it("still refuses a table replacement when the diff comes with colour codes", async () => {
    const red = "\u001b[31m";
    const reset = "\u001b[39m";
    const { deps, commands } = fakeMachine({
      yes: [true],
      ...merged,
      diff: `Stack GangshowCasting\n${red}[~] AWS::DynamoDB::Table DataTable DataTable447BC44E replace${reset}\n`,
    });

    expect(await release([], deps)).toBe(1);
    didNotDeploy(commands);
  });

  it("leaves the deploy and the check the terminal, to show progress and ask their own questions", async () => {
    const { deps, optionsOf } = fakeMachine({
      yes: [true, true, true],
      tagsBefore: "v0.1.0\nv0.2.0\n",
    });

    await release(["v0.2.0"], deps);

    expect(optionsOf["pnpm infra:deploy"]).toEqual({ output: "none" });
    expect(
      optionsOf["pnpm check:hosted https://made-up.example/ check-admin check-member"],
    ).toMatchObject({
      output: "none",
    });
  });

  it("says which AWS account the deploy goes to when it asks", async () => {
    const { deps, asked } = fakeMachine({ yes: [true, false], ...merged });

    await release([], deps);

    expect(asked.at(-1)).toContain("123456789012");
    expect(asked.at(-1)).toContain("made-up");
  });

  it("refuses a diff that would replace the table or user pool, and returns to main", async () => {
    const { deps, commands, printed } = fakeMachine({
      yes: [true],
      ...merged,
      diff: "Stack GangshowCasting\n[~] AWS::DynamoDB::Table DataTable DataTable447BC44E replace\n",
    });

    expect(await release([], deps)).toBe(1);
    didNotDeploy(commands);
    endedOnMain(commands);
    expect(printed.join("\n")).toContain("would replace or remove");
  });

  it("shows what else the deploy removes or replaces before asking", async () => {
    const { deps, printed } = fakeMachine({
      yes: [true, false],
      ...merged,
      diff: "Stack GangshowCasting\n[-] AWS::S3::Bucket Pages PagesAB12 destroy\n",
    });

    await release([], deps);

    expect(printed.join("\n")).toContain("AWS::S3::Bucket Pages PagesAB12 destroy");
  });

  it("won't deploy a diff it couldn't read: a failed or empty cdk diff isn't 'safe'", async () => {
    for (const machine of [
      fakeMachine({ yes: [true], ...merged, fail: ["pnpm infra:diff"] }),
      fakeMachine({
        yes: [true],
        ...merged,
        reply: { "pnpm infra:diff": { code: 0, output: "" } },
      }),
    ]) {
      expect(await release([], machine.deps)).toBe(1);
      didNotDeploy(machine.commands);
      endedOnMain(machine.commands);
      expect(machine.printed.join("\n")).toContain("Couldn't read the deploy's diff");
    }
  });

  it("doesn't deploy if you say no after reading the diff", async () => {
    const { deps, commands } = fakeMachine({ yes: [true, false], ...merged });

    expect(await release([], deps)).toBe(0);
    didNotDeploy(commands);
    endedOnMain(commands);
  });

  it.each([
    ["switch to the tag", "git switch --detach v0.2.0"],
    ["install the dependencies", "pnpm install --frozen-lockfile"],
  ])("won't deploy if it can't %s", async (_name, failing) => {
    const { deps, commands } = fakeMachine({ yes: [true], ...merged, fail: [failing] });

    expect(await release([], deps)).toBe(1);
    didNotDeploy(commands);
    endedOnMain(commands);
  });

  it("won't deploy if the code turns out not to be at the tag", async () => {
    const { deps, commands, printed } = fakeMachine({
      yes: [true],
      ...merged,
      reply: { "git describe --exact-match --tags HEAD": { code: 0, output: "v0.1.0\n" } },
    });

    expect(await release([], deps)).toBe(1);
    didNotDeploy(commands);
    expect(commands).not.toContain("pnpm infra:diff");
    expect(printed.join("\n")).toContain("isn't at v0.2.0");
  });

  it("reports a failed deploy, and still returns to main", async () => {
    const { deps, commands, printed } = fakeMachine({
      yes: [true, true],
      ...merged,
      fail: ["pnpm infra:deploy"],
    });

    expect(await release([], deps)).toBe(1);
    endedOnMain(commands);
    expect(printed.join("\n")).toContain("The deploy failed");
  });
});

describe("release: a given version", () => {
  const both = { tagsBefore: "v0.1.0\nv0.2.0\n" };

  it("deploys it without merging anything, to redeploy or go back", async () => {
    const { deps, commands } = fakeMachine({ yes: [true, true, false], ...both });

    expect(await release(["v0.1.0"], deps)).toBe(0);
    expect(commands.some((c) => c.startsWith("gh pr"))).toBe(false);
    expect(commands).toContain("git switch --detach v0.1.0");
    expect(commands).toContain("pnpm infra:deploy");
    endedOnMain(commands);
  });

  it("doesn't claim to know which version it replaces", async () => {
    const { deps, printed } = fakeMachine({ yes: [true, false], ...both });

    await release(["v0.1.0"], deps);

    expect(printed.join("\n")).not.toContain("version you're replacing");
  });

  it("refuses a version that isn't a tag", async () => {
    const { deps, commands } = fakeMachine(both);

    expect(await release(["v9.9.9"], deps)).toBe(1);
    didNotDeploy(commands);
    expect(commands).not.toContain("git switch --detach v9.9.9");
  });

  it("refuses something that only looks like a flag", async () => {
    const { deps, commands } = fakeMachine(both);

    expect(await release(["--force"], deps)).toBe(1);
    expect(commands.some((c) => c.includes("--force"))).toBe(false);
  });
});

describe("release: the post-deploy check", () => {
  const both = { tagsBefore: "v0.1.0\nv0.2.0\n" };

  it("runs from the stack's outputs when asked, naming the check accounts", async () => {
    const { deps, checks } = fakeMachine({ yes: [true, true, true], ...both });

    expect(await release(["v0.2.0"], deps)).toBe(0);
    expect(checks).toEqual([
      {
        line: "pnpm check:hosted https://made-up.example/ check-admin check-member",
        env: { USER_POOL_ID: "eu-west-2_madeup", CHECK_CLIENT_ID: "made-up-client" },
      },
    ]);
  });

  it("uses the check accounts the maintainer names", async () => {
    const { deps, checks } = fakeMachine({
      yes: [true, true, true],
      ...both,
      env: {
        ALERT_EMAIL: "made-up@example.com",
        AWS_PROFILE: "made-up",
        CHECK_ADMIN: "boss",
        CHECK_MEMBER: "helper",
      },
    });

    await release(["v0.2.0"], deps);

    expect(checks[0]?.line).toBe("pnpm check:hosted https://made-up.example/ boss helper");
  });

  it("reminds the maintainer to disable the check accounts", async () => {
    const { deps, printed } = fakeMachine({ yes: [true, true, true], ...both });

    await release(["v0.2.0"], deps);

    expect(printed.join("\n")).toContain("Disable the check accounts");
  });

  it("is skipped if you say no", async () => {
    const { deps, checks } = fakeMachine({ yes: [true, true, false], ...both });

    expect(await release(["v0.2.0"], deps)).toBe(0);
    expect(checks).toEqual([]);
  });

  it("makes the release fail if the check does", async () => {
    const { deps } = fakeMachine({
      yes: [true, true, true],
      ...both,
      fail: ["pnpm check:hosted https://made-up.example/ check-admin check-member"],
    });

    expect(await release(["v0.2.0"], deps)).toBe(1);
  });

  it("doesn't run against nothing if the stack's outputs can't be read", async () => {
    const { deps, checks, printed } = fakeMachine({
      yes: [true, true, true],
      ...both,
      fail: [
        "aws cloudformation describe-stacks --stack-name GangshowCasting --region eu-west-2 --query Stacks[0].Outputs --output json",
      ],
    });

    expect(await release(["v0.2.0"], deps)).toBe(1);
    expect(checks).toEqual([]);
    expect(printed.join("\n")).toContain("Couldn't read the stack's");
  });
});
