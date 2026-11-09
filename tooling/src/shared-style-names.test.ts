import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CLAUDE.md, "Name shared things for what they are": a new page reuses these looks without
// first learning which page they were borrowed from.
const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const css = read("apps/web/src/assets/styles.css");
const brief = read(".claude/agents/ux-reviewer.md");
const webFiles = readdirSync(new URL("apps/web/src/", root), { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".vue"))
  .map((file) => ({ file, source: read(`apps/web/src/${file}`) }));

const borrowedNames = [
  "role-card",
  "role-cards",
  "role-name",
  "role-actions",
  "cast-actions",
  "cast-filters",
  "cast-member-form",
  "cast-list",
  "cast-table",
  "running-order",
  "moves",
];
const purposeNames = [
  "card",
  "card-list",
  "card-name",
  "card-icons",
  "button-row",
  "filter-bar",
  "form",
  "data-table",
  "data-table-box",
  "items-table",
  "icon-column",
];

const hasStyle = (name: string) => new RegExp(`\\.${name}(?![\\w-])`).test(css);
const classAttributes = (source: string) =>
  [...source.matchAll(/(?<![\w-])class="([^"]*)"/g)].flatMap((match) =>
    (match[1] ?? "").split(/\s+/),
  );

describe("shared style names", () => {
  it.each(purposeNames)("styles .%s", (name) => {
    expect(hasStyle(name)).toBe(true);
  });

  it.each(borrowedNames)("no longer styles .%s, a name borrowed from one page", (name) => {
    expect(hasStyle(name)).toBe(false);
  });

  it("uses no borrowed name in any component's classes", () => {
    const borrowed = webFiles.flatMap(({ file, source }) =>
      classAttributes(source)
        .filter((name) => borrowedNames.includes(name))
        .map((name) => `${file}: ${name}`),
    );
    expect(borrowed).toEqual([]);
  });

  it("gives the UX reviewer the purpose names to reuse", () => {
    for (const name of ["card", "button-row", "form", "data-table"]) {
      expect(brief).toContain(`\`.${name}\``);
    }
    for (const name of borrowedNames) {
      expect(brief).not.toContain(`\`.${name}\``);
    }
  });
});
