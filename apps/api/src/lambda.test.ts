import { HealthResponse } from "@app/shared";
import { describe, expect, it } from "vitest";
import type { Handler } from "./handler.ts";
import { handler, lambdaEntry } from "./lambda.ts";

// The parts of an API Gateway HTTP API (payload v2) event that the entry point reads.
const request = (method: string, rawPath: string, extra = {}) => ({
  rawPath,
  requestContext: { http: { method } },
  ...extra,
});

describe("Lambda entry point", () => {
  it("runs the health handler for GET /api/health", async () => {
    const res = await handler(request("GET", "/api/health"));

    expect(res.statusCode).toBe(200);
    expect(HealthResponse.parse(JSON.parse(res.body ?? "")).status).toBe("ok");
  });

  it("passes the matched path parameters, query and body to the handler", async () => {
    const echo: Handler = async (event) => ({ statusCode: 200, body: JSON.stringify(event) });
    const entry = lambdaEntry({ "PUT /api/things/{thingId}": echo });

    const res = await entry(
      request("PUT", "/api/things/a%20b", {
        queryStringParameters: { q: "1" },
        body: '{"name":"x"}',
      }),
    );

    expect(JSON.parse(res.body ?? "")).toMatchObject({
      pathParameters: { thingId: "a b" },
      queryStringParameters: { q: "1" },
      body: '{"name":"x"}',
    });
  });

  it("returns 404 with no body for a path it doesn't serve", async () => {
    const res = await handler(request("GET", "/api/nope"));

    expect(res).toEqual({ statusCode: 404 });
  });
});
