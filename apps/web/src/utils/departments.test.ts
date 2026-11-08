import { describe, expect, it } from "vitest";
import { refusedLine, whoCanChangeLine } from "./departments.ts";

describe("whoCanChangeLine", () => {
  it.each([
    ["casting", "Only Casting and admins can change the casting."],
    ["props", "Only Stage, Director and admins can change the props."],
    ["scenery", "Only Stage, Tech, Director and admins can change the scenery."],
    ["sfx", "Only Tech, Director and admins can change the SFX."],
    ["mic-plot", "Only Tech, Director and admins can change the mic plot."],
    ["wardrobe", "Only Wardrobe, Director and admins can change the wardrobe."],
  ] as const)("says who may change the %s", (id, line) => {
    expect(whoCanChangeLine(id)).toBe(line);
  });
});

describe("refusedLine", () => {
  it.each([
    ["casting", "You can view the casting but not change it, so this wasn't saved."],
    ["props", "You can view the props but not change them, so this wasn't saved."],
    ["scenery", "You can view the scenery but not change it, so this wasn't saved."],
    ["sfx", "You can view the SFX but not change them, so this wasn't saved."],
    ["mic-plot", "You can view the mic plot but not change it, so this wasn't saved."],
    ["wardrobe", "You can view the wardrobe but not change it, so this wasn't saved."],
  ] as const)("says a refused change to the %s wasn't saved", (id, line) => {
    expect(refusedLine(id)).toBe(line);
  });
});
