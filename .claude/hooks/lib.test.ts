import { describe, expect, it } from "vitest";
import { shouldRunGate, typecheckFor } from "./lib.ts";

describe("typecheckFor", () => {
  it.each([
    ["apps/web/src/App.vue", ["--filter", "web", "typecheck"]],
    ["apps/api/src/health.ts", ["--filter", "api", "typecheck"]],
    ["infra/lib/app-stack.ts", ["--filter", "infra", "typecheck"]],
    ["packages/shared/src/health.ts", ["--filter", "@app/shared", "typecheck"]],
    ["tooling/src/validate-docs.ts", ["--filter", "tooling", "typecheck"]],
    [".claude/hooks/guard.ts", ["typecheck:harness"]],
  ])("%s → pnpm %j", (path, args) => {
    expect(typecheckFor(path)).toEqual(args);
  });

  it("returns undefined for non-code files", () => {
    expect(typecheckFor("README.md")).toBeUndefined();
    expect(typecheckFor("apps/web/package.json")).toBeUndefined();
  });
});

describe("shouldRunGate", () => {
  it("skips when the agent is already retrying after a failed gate", () => {
    expect(shouldRunGate({ stopHookActive: true, dirty: true, aheadOfMain: true })).toBe(false);
  });

  it("skips when nothing changed (e.g. the agent only answered a question)", () => {
    expect(shouldRunGate({ stopHookActive: false, dirty: false, aheadOfMain: false })).toBe(false);
  });

  it("runs when there are uncommitted or unmerged changes", () => {
    expect(shouldRunGate({ stopHookActive: false, dirty: true, aheadOfMain: false })).toBe(true);
    expect(shouldRunGate({ stopHookActive: false, dirty: false, aheadOfMain: true })).toBe(true);
  });
});
