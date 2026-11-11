import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A long test file costs every person and agent who opens it (ADR 0038).
const LIMIT = 800;

// Older files over the limit, each at most the size shown. Lower a number when a file shrinks,
// and take a file off once it's within the limit. Never raise one or add one.
const overBudget = new Map([
  ["apps/web/src/pages/CastingItemPage.test.ts", 2070],
  ["apps/web/src/pages/CastingOverviewPage.test.ts", 2018],
  ["apps/api/src/lambda.test.ts", 1841],
  ["apps/web/src/pages/PropsItemPage.test.ts", 1752],
  ["apps/web/src/pages/RunningOrderPage.test.ts", 1491],
  ["apps/web/src/pages/SceneryItemPage.test.ts", 1322],
  ["apps/web/src/App.test.ts", 1198],
  ["apps/web/src/pages/CastPage.test.ts", 1174],
  ["apps/web/src/pages/AccountsPage.test.ts", 1052],
  ["apps/web/src/pages/ProductionOverviewPage.test.ts", 1036],
  ["apps/api/src/show/running-order/save-running-order.test.ts", 941],
  ["apps/web/src/pages/MicPlotItemPage.test.ts", 901],
  ["infra/lib/app-stack.test.ts", 891],
]);

const root = new URL("../../", import.meta.url);
const linesIn = (file: string) => readFileSync(new URL(file, root), "utf8").split("\n").length - 1;
const testFiles = execFileSync("git", ["ls-files", "*.test.ts"], { cwd: root })
  .toString()
  .trim()
  .split("\n");

describe("the size of test files", () => {
  it.each(testFiles)("keeps %s within its budget", (file) => {
    expect(linesIn(file)).toBeLessThanOrEqual(overBudget.get(file) ?? LIMIT);
  });

  it.each([...overBudget.keys()])("still needs a place on the list: %s", (file) => {
    expect(linesIn(file)).toBeGreaterThan(LIMIT);
  });
});
