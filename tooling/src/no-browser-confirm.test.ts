import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// confirm-and-loading FR1: every question asks in iCUE's own dialog (useConfirm), never the
// browser's box, which can't name its buttons and looks different on every phone.
const web = new URL("../../apps/web/src/", import.meta.url);

const code = readdirSync(web, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.(ts|vue)$/.test(file))
  .filter((file) => !/\.(test|fixture)\.ts$/.test(file) && file !== "test-setup.ts")
  .map((file) => ({ file, source: readFileSync(new URL(file, web), "utf8") }));

// A bare confirm( call, or window.confirm (or globalThis's, self's) in any form; askToConfirm(
// and the like don't count.
const BROWSER_CONFIRM = /(?<![\w.$])confirm\s*\(|\b(?:window|globalThis|self)\s*\.\s*confirm\b/;

describe("the web app's questions", () => {
  it("never use the browser's own confirm box", () => {
    const callers = code
      .filter(({ source }) => BROWSER_CONFIRM.test(source))
      .map(({ file }) => file);
    expect(callers).toEqual([]);
  });
});
