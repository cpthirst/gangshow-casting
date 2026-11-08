import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CLAUDE.md, "Say a thing once": the production comes from one file, so that showing another
// means changing that file. Tests and fixtures hold made-up data, so they don't count.
const web = new URL("../../apps/web/src/", import.meta.url);
const THE_ONE_PLACE = "utils/production.ts";

const code = readdirSync(web, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.(ts|vue)$/.test(file))
  .filter((file) => !/\.(test|fixture)\.ts$/.test(file) && file !== "test-setup.ts")
  .map((file) => ({ file, source: readFileSync(new URL(file, web), "utf8") }));

const filesWith = (text: string) =>
  code.filter(({ source }) => source.includes(text)).map(({ file }) => file);

describe("the web app's production", () => {
  it("is named in one place", () => {
    expect(filesWith("2027")).toEqual([THE_ONE_PLACE]);
  });

  it("is the only place that builds a production's address", () => {
    expect(filesWith("/api/productions")).toEqual([THE_ONE_PLACE]);
  });
});
