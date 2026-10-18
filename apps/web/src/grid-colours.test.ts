import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gridLetterColours, gridTextColour, unprintedHeadingColour } from "@app/shared";
import { describe, expect, it } from "vitest";

// Read from disk: Vite hands tests an empty string for a stylesheet imported as raw text.
// Tests run from apps/web.
const css = readFileSync(resolve("src/styles.css"), "utf8");

// The Excel file takes its colours from packages/shared; the screen takes them from the
// stylesheet. These checks keep the two the same.

const ruleFor = (selector: string) =>
  new RegExp(`(?:^|\\n)([^{}]*${selector.replace(".", "\\.")}[^{}]*)\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? "";

/** A value that may be a variable, such as `var(--surface)`, as the "#rrggbb" it stands for. */
const resolved = (value: string) => {
  const name = /var\((--[a-z-]+)\)/.exec(value)?.[1];
  return name ? (new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1] ?? "") : value;
};

describe("the grid's colours", () => {
  it.each([
    ["L", ".grid-dot-lead"],
    ["S", ".grid-dot-support"],
    ["C", ".grid-dot-cameo"],
    ["E", ".grid-dot-ensemble"],
  ] as const)("fills a %s dot on screen as the file fills its cell", (letter, selector) => {
    const background = /background:\s*([^;]+);/.exec(ruleFor(selector))?.[1] ?? "";

    expect(resolved(background.trim()).toLowerCase()).toBe(gridLetterColours[letter]);
  });

  it("shows an unprinted heading in the red the file uses", () => {
    const colour = /(?:^|\s)color:\s*([^;]+);/.exec(ruleFor(".grid-unprinted"))?.[1] ?? "";

    expect(resolved(colour.trim()).toLowerCase()).toBe(unprintedHeadingColour);
  });

  it("sets the letters in the text colour the file uses", () => {
    expect(/--text:\s*(#[0-9a-f]{6})/i.exec(css)?.[1]?.toLowerCase()).toBe(gridTextColour);
  });
});
