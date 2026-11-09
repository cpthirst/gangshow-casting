import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CLAUDE.md: the production comes from one place, never a hard-coded id. The web app learns it
// from the API's list (ADR 0036). Tests and fixtures hold made-up data, so they don't count.
const web = new URL("../../apps/web/src/", import.meta.url);
const THE_ONE_PLACE = "services/production.ts";

const code = readdirSync(web, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.(ts|vue)$/.test(file))
  .filter((file) => !/\.(test|fixture)\.ts$/.test(file) && file !== "test-setup.ts")
  .map((file) => ({ file, source: readFileSync(new URL(file, web), "utf8") }));

const filesWith = (text: string) =>
  code.filter(({ source }) => source.includes(text)).map(({ file }) => file);

describe("the web app's production", () => {
  it("is never named in the code", () => {
    expect(filesWith("2027")).toEqual([]);
  });

  it("is the only place that builds a production's address", () => {
    expect(filesWith("/api/productions")).toEqual([THE_ONE_PLACE]);
  });
});
