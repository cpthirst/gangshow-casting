import { describe, expect, it } from "vitest";
import { HealthResponse } from "./health.ts";

describe("HealthResponse", () => {
  it("accepts a valid payload", () => {
    expect(HealthResponse.parse({ status: "ok", version: "1.0.0" })).toEqual({
      status: "ok",
      version: "1.0.0",
    });
  });

  it("rejects an unknown status", () => {
    expect(() => HealthResponse.parse({ status: "down", version: "1.0.0" })).toThrow();
  });
});
