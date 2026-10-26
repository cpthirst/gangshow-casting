import { HealthResponse } from "@app/shared";
import { describe, expect, it } from "vitest";
import rootPackage from "../../../package.json" with { type: "json" };
import { handler } from "./health.ts";

// The app's release number, as release-please sets it in the root package.json.
const rootVersion = rootPackage.version;

describe("health handler", () => {
  it("returns 200 with a body that satisfies HealthResponse", async () => {
    const res = await handler();

    expect(res.statusCode).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "application/json" });
    expect(HealthResponse.parse(JSON.parse(res.body ?? "")).status).toBe("ok");
  });

  it("reports the app's release number from the root package.json, wherever it runs", async () => {
    const res = await handler();

    expect(rootVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(HealthResponse.parse(JSON.parse(res.body ?? "")).version).toBe(rootVersion);
  });
});
