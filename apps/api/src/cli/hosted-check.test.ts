import { adminOnlyRouteKeys, readOnlyMayUse, routeKeys } from "@app/shared";
import { describe, expect, it } from "vitest";
import { runHostedCheck, type SignIn } from "./hosted-check.ts";

const API = "https://abc123.execute-api.eu-west-2.amazonaws.com";
const ROUTES = ["GET /api/health", "DELETE /api/productions/{productionId}/cast/{castId}"];
const ENV = { USER_POOL_ID: "eu-west-2_madeup", CHECK_CLIENT_ID: "made-up-check-client" };
const TOKEN = "made-up-access-token";
const MEMBER_TOKEN = "made-up-member-access-token";
const READ_ONLY_TOKEN = "made-up-read-only-access-token";
const tokenFor = async ({ username }: { username: string }) =>
  ({ "check-admin": TOKEN, "check-read-only": READ_ONLY_TOKEN })[username] ?? MEMBER_TOKEN;
// Each admin-only route, as the check requests it.
const ADMIN_ONLY = adminOnlyRouteKeys.map((key) => key.replaceAll(/\{\w+\}/g, "check"));

type Answer = (method: string, path: string, headers: Headers) => Response;
// The API as deployed: only the check accounts' real tokens get through, the admin-only
// routes refuse the member, and every change refuses the read-only account. The casting
// grid export changes nothing, so it works for every role (ADR 0021).
const asDeployed: Answer = (method, path, headers) => {
  const authorization = headers.get("authorization");
  if (authorization === `Bearer ${READ_ONLY_TOKEN}`) {
    return method === "GET" || path.endsWith("/casting-grid/export")
      ? Response.json({ status: "ok", version: "0.0.0" })
      : Response.json({ message: "You can view the casting, but not change it." }, { status: 403 });
  }
  if (authorization === `Bearer ${MEMBER_TOKEN}` && ADMIN_ONLY.includes(`${method} ${path}`)) {
    return Response.json({ message: "Only admins can do this." }, { status: 403 });
  }
  return authorization === `Bearer ${TOKEN}` || authorization === `Bearer ${MEMBER_TOKEN}`
    ? Response.json({ status: "ok", version: "0.0.0" })
    : new Response('{"message":"Unauthorized"}', { status: 401 });
};

const run = async ({
  answer = asDeployed,
  args = [API, "check-admin", "check-member", "check-read-only"],
  env = ENV,
  routes = ROUTES,
  signIn = tokenFor,
}: {
  answer?: Answer;
  args?: string[];
  env?: Record<string, string>;
  routes?: string[];
  signIn?: SignIn;
} = {}) => {
  const requests: { method: string; path: string; authorization: string | null }[] = [];
  const signIns: Parameters<SignIn>[0][] = [];
  const fakeFetch = async (url: string, init: RequestInit) => {
    const { pathname } = new URL(url);
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers);
    requests.push({ method, path: pathname, authorization: headers.get("authorization") });
    return answer(method, pathname, headers);
  };
  const lines: string[] = [];
  const code = await runHostedCheck(args, env, {
    print: (line) => lines.push(line),
    fetch: fakeFetch,
    routeKeys: routes,
    signIn: async (account) => {
      signIns.push(account);
      return signIn(account);
    },
  });
  return { code, lines, requests, signIns };
};

const withoutToken = ({ method, path }: { method: string; path: string }) => `${method} ${path}`;

describe("the post-deploy check", () => {
  it("passes when every route and an unknown path refuse a request with no token", async () => {
    const { code, lines, requests } = await run();

    expect(code).toBe(0);
    expect(requests.filter((r) => r.authorization === null)).toEqual([
      { method: "GET", path: "/api/health", authorization: null },
      { method: "DELETE", path: "/api/productions/check/cast/check", authorization: null },
      { method: "GET", path: "/api/nope", authorization: null },
    ]);
    expect(lines.at(-1)).toBe(
      "PASS: the API refuses anyone not signed in, lets the check admin in, keeps admin-only routes for admins, and lets the read-only account change nothing",
    );
  });

  it("checks that a made-up token is refused too", async () => {
    const { requests } = await run();

    expect(requests).toContainEqual({
      method: "GET",
      path: "/api/health",
      authorization: expect.stringMatching(/^Bearer \S+\.\S+\.\S+$/),
    });
  });

  it("signs in as the check admin, through the check client, and gets the health route", async () => {
    const { code, lines, requests, signIns } = await run();

    expect(code).toBe(0);
    expect(signIns).toContainEqual({
      userPoolId: "eu-west-2_madeup",
      clientId: "made-up-check-client",
      username: "check-admin",
    });
    expect(requests).toContainEqual({
      method: "GET",
      path: "/api/health",
      authorization: `Bearer ${TOKEN}`,
    });
    expect(lines).toContain("PASS 200 GET /api/health, signed in as check-admin (expected 200)");
  });

  it("fails when the signed-in request isn't let in", async () => {
    const { code, lines } = await run({
      answer: () => new Response(null, { status: 401 }),
    });

    expect(code).toBe(1);
    expect(lines).toContain("FAIL 401 GET /api/health, signed in as check-admin (expected 200)");
    expect(lines.at(-1)).toBe("FAIL: the API didn't answer as it should; don't use this deploy");
  });

  it("fails, naming only the kind of error, when the check admin can't sign in, and still checks the refusals", async () => {
    const { code, lines, requests } = await run({
      signIn: async () => {
        throw Object.assign(new Error("check-admin: details"), { name: "NotAuthorizedException" });
      },
    });

    expect(code).toBe(1);
    expect(lines).toContain("FAIL couldn't sign in as check-admin (NotAuthorizedException)");
    expect(lines.join("\n")).not.toContain("details");
    expect(requests.filter((r) => r.authorization === null)).toHaveLength(3);
  });

  it("fails, naming the request, when a route answers without sign-in", async () => {
    const { code, lines } = await run({
      answer: (method, path, headers) =>
        method === "GET" && path === "/api/nope"
          ? new Response(null, { status: 404 })
          : asDeployed(method, path, headers),
    });

    expect(code).toBe(1);
    expect(lines).toContain("FAIL 404 GET /api/nope, no token (expected 401)");
    expect(lines.at(-1)).toBe("FAIL: the API didn't answer as it should; don't use this deploy");
  });

  it("fails when the API accepts a made-up token", async () => {
    const { code, lines } = await run({
      answer: (_method, _path, headers) =>
        headers.has("authorization")
          ? new Response(null, { status: 200 })
          : new Response(null, { status: 401 }),
    });

    expect(code).toBe(1);
    expect(lines).toContain("FAIL 200 GET /api/health, made-up token (expected 401)");
  });

  it("checks every route the API has by default, passing only when each refuses", async () => {
    const requested: string[] = [];
    const lines: string[] = [];
    const fakeFetch = async (url: string, init: RequestInit) => {
      const { pathname } = new URL(url);
      requested.push(`${init.method} ${pathname}`);
      return asDeployed(init.method ?? "GET", pathname, new Headers(init.headers));
    };

    const code = await runHostedCheck(
      [API, "check-admin", "check-member", "check-read-only"],
      ENV,
      {
        print: (line) => lines.push(line),
        fetch: fakeFetch,
        signIn: tokenFor,
      },
    );

    const pathFor = (key: string) => key.replaceAll(/\{\w+\}/g, "check");
    expect(requested).toEqual(expect.arrayContaining(routeKeys.map(pathFor)));
    expect(lines.filter((line) => line.endsWith("no token (expected 401)"))).toHaveLength(
      routeKeys.length + 1,
    );
    // Every change route, current and future, as the read-only account.
    const changes = routeKeys.filter((key) => !readOnlyMayUse(key));
    expect(
      lines.filter((line) => /signed in as check-read-only \(expected 403\)$/.test(line)),
    ).toHaveLength(changes.length);
    expect(code).toBe(0);
  });

  it("expects the casting grid export to work for the member and the read-only account (ADR 0021)", async () => {
    const { lines, code } = await run({ routes: [...routeKeys] });

    const exportLines = lines.filter((line) => line.includes("/casting-grid/export"));
    // It is checked: anyone not signed in is refused it.
    expect(exportLines).toEqual([expect.stringMatching(/no token \(expected 401\)$/)]);
    expect(code).toBe(0);
  });

  it("doesn't expect the read-only account to be refused recording its own usage (ADR 0023)", async () => {
    const { lines, code } = await run({ routes: [...routeKeys] });

    const recordLines = lines.filter((line) => line.includes("POST /api/usage"));
    expect(recordLines).toEqual([expect.stringMatching(/no token \(expected 401\)$/)]);
    expect(code).toBe(0);
  });

  it("never prints what the API sent back", async () => {
    const { lines } = await run({
      answer: () => new Response("Alex Example, 1st Chester", { status: 200 }),
    });

    expect(lines.join("\n")).not.toContain("Alex Example");
  });

  it("fails when the API can't be reached", async () => {
    const { code, lines } = await run({
      answer: () => {
        throw new TypeError("fetch failed");
      },
    });

    expect(code).toBe(1);
    expect(lines).toContain("FAIL unreachable GET /api/health, no token (expected 401)");
  });

  it("signs in as the check member and confirms each admin-only route refuses it", async () => {
    const { code, lines, requests, signIns } = await run();

    expect(code).toBe(0);
    expect(signIns.map((account) => account.username)).toEqual([
      "check-admin",
      "check-member",
      "check-read-only",
    ]);
    expect(
      requests.filter((r) => r.authorization === `Bearer ${MEMBER_TOKEN}`).map(withoutToken),
    ).toEqual(ADMIN_ONLY);
    expect(lines).toContain(
      "PASS 403 DELETE /api/productions/check/cast/check, signed in as check-member (expected 403)",
    );
    expect(lines).toContain(
      "PASS 403 POST /api/productions/check/running-order/versions, signed in as check-member (expected 403)",
    );
    expect(lines).toContain("PASS 403 GET /api/accounts, signed in as check-member (expected 403)");
  });

  it("never sends an admin-only request as the check admin", async () => {
    const { requests } = await run();

    const asAdmin = requests.filter((r) => r.authorization === `Bearer ${TOKEN}`);
    expect(asAdmin.map(withoutToken)).toEqual(["GET /api/health"]);
  });

  it("fails when an admin-only route doesn't refuse the check member", async () => {
    const { code, lines } = await run({
      answer: (method, path, headers) =>
        method === "POST" ? new Response(null, { status: 400 }) : asDeployed(method, path, headers),
    });

    expect(code).toBe(1);
    expect(lines).toContain(
      "FAIL 400 POST /api/productions/check/running-order/versions, signed in as check-member (expected 403)",
    );
  });

  it("sends each change route as the read-only account, passing when each is refused", async () => {
    const { code, lines, requests } = await run();

    expect(code).toBe(0);
    expect(
      requests.filter((r) => r.authorization === `Bearer ${READ_ONLY_TOKEN}`).map(withoutToken),
    ).toEqual(["DELETE /api/productions/check/cast/check", "GET /api/health"]);
    expect(lines).toContain(
      "PASS 403 DELETE /api/productions/check/cast/check, signed in as check-read-only (expected 403)",
    );
  });

  it("lets the read-only account read", async () => {
    const { lines } = await run();

    expect(lines).toContain(
      "PASS 200 GET /api/health, signed in as check-read-only (expected 200)",
    );
  });

  it("fails, naming the route and its status but no data, when a change accepts the read-only account", async () => {
    const { code, lines } = await run({
      answer: (method, path, headers) =>
        method === "DELETE" && headers.get("authorization") === `Bearer ${READ_ONLY_TOKEN}`
          ? Response.json({ members: ["Alex Example"] })
          : asDeployed(method, path, headers),
    });

    expect(code).toBe(1);
    expect(lines).toContain(
      "FAIL 200 DELETE /api/productions/check/cast/check, signed in as check-read-only (expected 403)",
    );
    expect(lines.join("\n")).not.toContain("Alex Example");
    expect(lines.at(-1)).toBe("FAIL: the API didn't answer as it should; don't use this deploy");
  });

  it("fails when the read-only account can't read", async () => {
    const { code, lines } = await run({
      answer: (method, path, headers) =>
        headers.get("authorization") === `Bearer ${READ_ONLY_TOKEN}`
          ? new Response(null, { status: 403 })
          : asDeployed(method, path, headers),
    });

    expect(code).toBe(1);
    expect(lines).toContain(
      "FAIL 403 GET /api/health, signed in as check-read-only (expected 200)",
    );
  });

  it.each([
    ["check-admin", "check-admin", "check-read-only"],
    ["check-admin", "check-member", "check-member"],
    ["check-admin", "check-member", "Check-Admin"],
  ])("refuses a username used for two check accounts (%s, %s, %s)", async (...usernames) => {
    const { code, lines, signIns } = await run({ args: [API, ...usernames] });

    expect(code).toBe(1);
    expect(lines).toEqual(["The check accounts need different usernames."]);
    expect(signIns).toEqual([]);
  });

  it("explains how to run it when not given an https address and all three check accounts", async () => {
    for (const args of [
      [],
      ["http://example.com", "check-admin", "check-member", "check-read-only"],
      [API],
      [API, "check-admin"],
      [API, "check-admin", "check-member"],
    ]) {
      const { code, lines, requests, signIns } = await run({ args });

      expect(code).toBe(1);
      expect(lines).toEqual([
        "Usage: pnpm check:hosted <https address of the app> <check admin username> <check member username> <check read-only username>",
      ]);
      expect(requests).toEqual([]);
      expect(signIns).toEqual([]);
    }
  });

  it("asks for the user pool and check client when they aren't set", async () => {
    for (const env of [
      { ...ENV, USER_POOL_ID: "" },
      { ...ENV, CHECK_CLIENT_ID: "" },
    ]) {
      const { code, lines, requests, signIns } = await run({ env });

      expect(code).toBe(1);
      expect(lines).toEqual([
        "Set USER_POOL_ID and CHECK_CLIENT_ID to the stack's UserPoolId and CheckClientId outputs.",
      ]);
      expect(requests).toEqual([]);
      expect(signIns).toEqual([]);
    }
  });
});
