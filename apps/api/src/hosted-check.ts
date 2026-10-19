import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
// Every route infra hosts, so a route added later is checked from its first deploy.
import { adminOnlyRouteKeys, routeKeys as allRouteKeys, isReadRoute } from "@app/shared";
import { signInWithPassword } from "./cognito-sign-in.ts";
import { cognitoClientFor } from "./cognito-user-directory.ts";

type Env = Record<string, string | undefined>;
type Fetch = (url: string, init: RequestInit) => Promise<Response>;
type CheckRequest = { method: string; path: string; token?: string; label: string };
type CheckAccount = { userPoolId: string; clientId: string; username: string };
/** Signs the check account in and returns its access token. */
export type SignIn = (account: CheckAccount) => Promise<string>;
type Deps = {
  print: (line: string) => void;
  signIn: SignIn;
  fetch?: Fetch;
  routeKeys?: string[];
};

const USAGE =
  "Usage: pnpm check:hosted <https address of the app> <check admin username> <check member username> <check read-only username>";

// Shaped like a sign-in token but signed by nobody, so the API must refuse it.
const toBase64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const MADE_UP_TOKEN = [
  toBase64Url({ alg: "RS256", kid: "made-up" }),
  toBase64Url({ iss: "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_madeup", exp: 4e9 }),
  "bm90LWEtc2lnbmF0dXJl",
].join(".");

// Any path parameter will do: the API must refuse before it looks at the path. "check" is
// no cast member's id, and the requests carry no body, so even a wrongly accepted request
// would be turned away by its handler without changing anything.
function requestFor(key: string) {
  const [method = "", route = ""] = key.split(" ");
  return { method, path: route.replaceAll(/\{\w+\}/g, "check") };
}

/** Every route, an unknown path, and a made-up token: each must get 401 (hosting FR17). */
function requestsToRefuse(routeKeys: string[]): CheckRequest[] {
  const signedOut = [...routeKeys, "GET /api/nope"].map((key) => {
    const { method, path } = requestFor(key);
    return { method, path, label: `${method} ${path}, no token` };
  });
  const madeUp = { method: "GET", path: "/api/health", token: MADE_UP_TOKEN };
  return [...signedOut, { ...madeUp, label: "GET /api/health, made-up token" }];
}

/**
 * Checks a deployed API refuses everyone not signed in, lets the check admin in, keeps
 * admin-only routes from the check member (hosting FR17), and lets the read-only account
 * read but change nothing (team-roles FR15). Prints only statuses, never what the API sent
 * back, which could hold cast data if the check fails. Returns the exit code.
 */
export async function runHostedCheck(args: string[], env: Env, deps: Deps): Promise<number> {
  const { print, fetch: fetchFn = fetch, routeKeys = [...allRouteKeys] } = deps;
  const [address = "", admin = "", member = "", readOnly = ""] = args;
  if (!address.startsWith("https://") || !admin || !member || !readOnly) {
    print(USAGE);
    return 1;
  }
  // Usernames ignore case in the pool, so "Check-Admin" is "check-admin".
  if (new Set([admin, member, readOnly].map((name) => name.toLowerCase())).size !== 3) {
    print("The check accounts need different usernames.");
    return 1;
  }
  const { USER_POOL_ID: userPoolId, CHECK_CLIENT_ID: clientId } = env;
  if (!userPoolId || !clientId) {
    print(
      "Set USER_POOL_ID and CHECK_CLIENT_ID to the stack's UserPoolId and CheckClientId outputs.",
    );
    return 1;
  }

  const signInAs = (username: string) =>
    deps.signIn({ userPoolId, clientId, username }).catch((error: unknown) => {
      // Only the error's kind: AWS's message can repeat what was sent.
      const kind = error instanceof Error ? error.name : "unknown error";
      print(`FAIL couldn't sign in as ${username} (${kind})`);
      return undefined;
    });
  // First, so the passwords are asked for before the requests start.
  const adminToken = await signInAs(admin);
  const memberToken = await signInAs(member);
  const readOnlyToken = await signInAs(readOnly);

  let allPassed = [adminToken, memberToken, readOnlyToken].every((token) => token !== undefined);
  const checkStatus = async (request: CheckRequest, expected: number) => {
    const status = await statusOf(fetchFn, new URL(request.path, address).href, request);
    allPassed &&= status === expected;
    print(
      `${status === expected ? "PASS" : "FAIL"} ${status} ${request.label} (expected ${expected})`,
    );
  };
  for (const request of requestsToRefuse(routeKeys)) await checkStatus(request, 401);
  if (adminToken) {
    const label = `GET /api/health, signed in as ${admin}`;
    await checkStatus({ method: "GET", path: "/api/health", token: adminToken, label }, 200);
  }
  // Only ever as the member: an admin's request could make the change.
  if (memberToken) {
    for (const key of adminOnlyRouteKeys) {
      const { method, path } = requestFor(key);
      const label = `${method} ${path}, signed in as ${member}`;
      await checkStatus({ method, path, token: memberToken, label }, 403);
    }
  }
  // Changes only as the read-only account, which the API refuses before any handler runs
  // (ADR 0020). The requests carry no body, so even a wrongly accepted one changes nothing.
  if (readOnlyToken) {
    for (const key of routeKeys.filter((key) => !isReadRoute(key))) {
      const { method, path } = requestFor(key);
      const label = `${method} ${path}, signed in as ${readOnly}`;
      await checkStatus({ method, path, token: readOnlyToken, label }, 403);
    }
    const label = `GET /api/health, signed in as ${readOnly}`;
    await checkStatus({ method: "GET", path: "/api/health", token: readOnlyToken, label }, 200);
  }
  print(
    allPassed
      ? "PASS: the API refuses anyone not signed in, lets the check admin in, keeps admin-only routes for admins, and lets the read-only account change nothing"
      : "FAIL: the API didn't answer as it should; don't use this deploy",
  );
  return allPassed ? 0 : 1;
}

async function statusOf(fetchFn: Fetch, url: string, { method, token }: CheckRequest) {
  const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
  try {
    const response = await fetchFn(url, { method, headers, redirect: "manual" });
    await response.body?.cancel();
    return response.status;
  } catch {
    return "unreachable";
  }
}

/** Asks on the terminal without showing what's typed, so the password isn't left on screen. */
async function askHidden(question: string) {
  process.stdout.write(question);
  const hidden = new Writable({ write: (_chunk, _encoding, done) => done() });
  const terminal = createInterface({ input: process.stdin, output: hidden, terminal: true });
  // In raw mode Ctrl-C reaches readline as a key, and the end of input never answers the
  // question: without these the prompt would wait for ever.
  terminal.once("SIGINT", () => {
    process.stdout.write("\n");
    process.exit(130);
  });
  const ended = new AbortController();
  terminal.once("close", () => ended.abort());
  try {
    return await terminal.question("", { signal: ended.signal });
  } finally {
    terminal.close();
    process.stdout.write("\n");
  }
}

if (import.meta.main) {
  process.exitCode = await runHostedCheck(process.argv.slice(2), process.env, {
    print: (line) => process.stdout.write(`${line}\n`),
    // The password comes from the maintainer at run time, never from the repository.
    signIn: async (account) => {
      const password = await askHidden(`Password for ${account.username}: `);
      return signInWithPassword(cognitoClientFor(account.userPoolId), { ...account, password });
    },
  });
}
