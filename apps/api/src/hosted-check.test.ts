import { describe, expect, it } from "vitest";
import { runHostedCheck } from "./hosted-check.ts";
import { routes } from "./routes.ts";

const API = "https://abc123.execute-api.eu-west-2.amazonaws.com";
const ROUTES = ["GET /api/health", "DELETE /api/productions/{productionId}/cast/{castId}"];

type Answer = (method: string, path: string, headers: Headers) => Response;
const refuseAll: Answer = () => new Response('{"message":"Unauthorized"}', { status: 401 });

const run = async (answer: Answer = refuseAll, args = [API]) => {
  const requests: { method: string; path: string; authorization: string | null }[] = [];
  const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
    const { pathname } = new URL(String(url));
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    requests.push({ method, path: pathname, authorization: headers.get("authorization") });
    return answer(method, pathname, headers);
  };
  const lines: string[] = [];
  const code = await runHostedCheck(args, (line) => lines.push(line), fakeFetch, ROUTES);
  return { code, lines, requests };
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
    expect(lines.at(-1)).toBe("PASS: the API refuses every request without a valid sign-in");
  });

  it("checks that a made-up token is refused too", async () => {
    const { requests } = await run();

    expect(requests).toContainEqual({
      method: "GET",
      path: "/api/health",
      authorization: expect.stringMatching(/^Bearer \S+\.\S+\.\S+$/),
    });
  });

  it("fails, naming the request, when a route answers without sign-in", async () => {
    const { code, lines } = await run((method, path) =>
      method === "GET" && path === "/api/nope"
        ? new Response(null, { status: 404 })
        : refuseAll(method, path, new Headers()),
    );

    expect(code).toBe(1);
    expect(lines).toContain("FAIL 404 GET /api/nope, no token (expected 401)");
    expect(lines.at(-1)).toBe("FAIL: some requests weren't refused; don't use this deploy");
  });

  it("fails when the API accepts a made-up token", async () => {
    const { code, lines } = await run((_method, _path, headers) =>
      headers.has("authorization")
        ? new Response(null, { status: 200 })
        : refuseAll("", "", headers),
    );

    expect(code).toBe(1);
    expect(lines).toContain("FAIL 200 GET /api/health, made-up token (expected 401)");
  });

  it("checks every route the API has, by default", async () => {
    const requested: string[] = [];
    const fakeFetch = async (url: string, init: RequestInit) => {
      requested.push(`${init.method} ${new URL(url).pathname}`);
      return refuseAll("", "", new Headers());
    };

    await runHostedCheck([API], () => {}, fakeFetch);

    const pathFor = (key: string) => key.replaceAll(/\{\w+\}/g, "check");
    expect(requested).toEqual(expect.arrayContaining(Object.keys(routes).map(pathFor)));
  });

  it("never prints what the API sent back", async () => {
    const { lines } = await run(() => new Response("Alex Example, 1st Chester", { status: 200 }));

    expect(lines.join("\n")).not.toContain("Alex Example");
  });

  it("fails when the API can't be reached", async () => {
    const { code, lines } = await run(() => {
      throw new TypeError("fetch failed");
    });

    expect(code).toBe(1);
    expect(lines).toContain("FAIL unreachable GET /api/health, no token (expected 401)");
  });

  it("explains how to run it when not given an https address", async () => {
    for (const args of [[], ["http://example.com"]]) {
      const { code, lines, requests } = await run(refuseAll, args);

      expect(code).toBe(1);
      expect(lines).toEqual(["Usage: pnpm check:hosted <https address of the API>"]);
      expect(requests).toEqual([]);
    }
  });
});
