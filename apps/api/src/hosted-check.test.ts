import { routeKeys } from "@app/shared";
import { describe, expect, it } from "vitest";
import { runHostedCheck, type SignIn } from "./hosted-check.ts";

const API = "https://abc123.execute-api.eu-west-2.amazonaws.com";
const ROUTES = ["GET /api/health", "DELETE /api/productions/{productionId}/cast/{castId}"];
const ENV = { USER_POOL_ID: "eu-west-2_madeup", CHECK_CLIENT_ID: "made-up-check-client" };
const TOKEN = "made-up-access-token";

type Answer = (method: string, path: string, headers: Headers) => Response;
// The API as deployed: only the check account's real token gets through.
const asDeployed: Answer = (_method, _path, headers) =>
  headers.get("authorization") === `Bearer ${TOKEN}`
    ? Response.json({ status: "ok", version: "0.0.0" })
    : new Response('{"message":"Unauthorized"}', { status: 401 });

const run = async ({
  answer = asDeployed,
  args = [API, "check-admin"],
  env = ENV,
  signIn = async () => TOKEN,
}: {
  answer?: Answer;
  args?: string[];
  env?: Record<string, string>;
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
    routeKeys: ROUTES,
    signIn: async (account) => {
      signIns.push(account);
      return signIn(account);
    },
  });
  return { code, lines, requests, signIns };
};

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
      "PASS: the API refuses every request without a valid sign-in, and lets a signed-in one in",
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
    expect(signIns).toEqual([
      {
        userPoolId: "eu-west-2_madeup",
        clientId: "made-up-check-client",
        username: "check-admin",
      },
    ]);
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
      requested.push(`${init.method} ${new URL(url).pathname}`);
      return asDeployed("", "", new Headers(init.headers));
    };

    const code = await runHostedCheck([API, "check-admin"], ENV, {
      print: (line) => lines.push(line),
      fetch: fakeFetch,
      signIn: async () => TOKEN,
    });

    const pathFor = (key: string) => key.replaceAll(/\{\w+\}/g, "check");
    expect(requested).toEqual(expect.arrayContaining(routeKeys.map(pathFor)));
    expect(lines.filter((line) => line.endsWith("no token (expected 401)"))).toHaveLength(
      routeKeys.length + 1,
    );
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

  it("explains how to run it when not given an https address and a check admin", async () => {
    for (const args of [[], ["http://example.com", "check-admin"], [API]]) {
      const { code, lines, requests, signIns } = await run({ args });

      expect(code).toBe(1);
      expect(lines).toEqual([
        "Usage: pnpm check:hosted <https address of the API> <check admin username>",
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
