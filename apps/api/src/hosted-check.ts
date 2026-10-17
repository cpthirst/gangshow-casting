// The whole route table, not just what is hosted so far: every route must refuse strangers,
// so a route added later is checked from its first deploy.
import { routes } from "./routes.ts";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;
type CheckRequest = { method: string; path: string; token?: string; label: string };

const USAGE = "Usage: pnpm check:hosted <https address of the API>";

// Shaped like a sign-in token but signed by nobody, so the API must refuse it.
const toBase64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const MADE_UP_TOKEN = [
  toBase64Url({ alg: "RS256", kid: "made-up" }),
  toBase64Url({ iss: "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_madeup", exp: 4e9 }),
  "bm90LWEtc2lnbmF0dXJl",
].join(".");

/** Every route, an unknown path, and a made-up token: each must get 401 (hosting FR17). */
function requestsToRefuse(routeKeys: string[]): CheckRequest[] {
  const signedOut = [...routeKeys, "GET /api/nope"].map((key) => {
    const [method = "", route = ""] = key.split(" ");
    // Any value will do: the API must refuse before it looks at the path.
    const path = route.replaceAll(/\{\w+\}/g, "check");
    return { method, path, label: `${method} ${path}, no token` };
  });
  const madeUp = { method: "GET", path: "/api/health", token: MADE_UP_TOKEN };
  return [...signedOut, { ...madeUp, label: "GET /api/health, made-up token" }];
}

/**
 * Checks a deployed API refuses everyone not signed in. Prints only statuses, never what
 * the API sent back, which could hold cast data if the check fails. Returns the exit code.
 */
export async function runHostedCheck(
  args: string[],
  print: (line: string) => void,
  fetchFn: Fetch = fetch,
  routeKeys: string[] = Object.keys(routes),
): Promise<number> {
  const [address = ""] = args;
  if (!address.startsWith("https://")) {
    print(USAGE);
    return 1;
  }
  let allRefused = true;
  for (const request of requestsToRefuse(routeKeys)) {
    const status = await statusOf(fetchFn, new URL(request.path, address).href, request);
    const refused = status === 401;
    allRefused &&= refused;
    print(`${refused ? "PASS" : "FAIL"} ${status} ${request.label} (expected 401)`);
  }
  print(
    allRefused
      ? "PASS: the API refuses every request without a valid sign-in"
      : "FAIL: some requests weren't refused; don't use this deploy",
  );
  return allRefused ? 0 : 1;
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

if (import.meta.main) {
  process.exitCode = await runHostedCheck(process.argv.slice(2), (line) => console.log(line));
}
