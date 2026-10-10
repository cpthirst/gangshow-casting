import { HealthResponse } from "@app/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handler } from "./health.ts";

describe("health handler", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns 200 with a body that satisfies HealthResponse", async () => {
    vi.stubEnv("APP_VERSION", "1.2.3");

    const res = await handler();

    expect(res.statusCode).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "application/json" });
    expect(HealthResponse.parse(JSON.parse(res.body ?? ""))).toEqual({
      status: "ok",
      version: "1.2.3",
    });
  });

  it("reports version 'dev' when APP_VERSION is not set", async () => {
    vi.stubEnv("APP_VERSION", undefined);

    const res = await handler();

    expect(HealthResponse.parse(JSON.parse(res.body ?? "")).version).toBe("dev");
  });
});
