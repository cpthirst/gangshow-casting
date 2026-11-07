import { describe, expect, it } from "vitest";
import { refusedLine, viewOnlyLine } from "./departments.ts";

describe("viewOnlyLine", () => {
  it.each([
    ["casting", "You can view the casting, but not change it: only Casting and admins can."],
    ["props", "You can view the props, but not change them: only Stage, Director and admins can."],
    [
      "scenery",
      "You can view the scenery, but not change it: only Stage, Tech, Director and admins can.",
    ],
    ["sfx", "You can view the SFX, but not change them: only Tech, Director and admins can."],
    [
      "mic-plot",
      "You can view the mic plot, but not change it: only Tech, Director and admins can.",
    ],
    [
      "wardrobe",
      "You can view the wardrobe, but not change it: only Wardrobe, Director and admins can.",
    ],
  ] as const)("says who may change the %s", (id, line) => {
    expect(viewOnlyLine(id)).toBe(line);
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
