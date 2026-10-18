import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AppStack } from "./app-stack.ts";
import { newApp, removeSynthesisedApps } from "./synth-for-test.ts";

describe("synthesising an app in a test", () => {
  it("leaves no output folder behind once the apps are removed", () => {
    const app = newApp();
    new AppStack(app, "Test", { alertEmail: "alerts@example.com" });
    expect(existsSync(app.outdir)).toBe(true);

    removeSynthesisedApps();

    expect(existsSync(app.outdir)).toBe(false);
  });
});
