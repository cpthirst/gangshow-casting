import { describe, expect, it } from "vitest";
import { propCountLabel, propCounts } from "./props.ts";

const aProp = (id: number, itemId: string) => ({ id, itemId, name: `Prop ${id}` });

describe("propCounts", () => {
  it("counts each item's props, by item id, with none for an item without props", () => {
    const counts = propCounts([
      aProp(1, "pirate-sketch"),
      aProp(2, "finale"),
      aProp(3, "pirate-sketch"),
    ]);

    expect(counts("pirate-sketch")).toBe(2);
    expect(counts("finale")).toBe(1);
    expect(counts("opening-number")).toBe(0);
  });
});

describe("propCountLabel", () => {
  it.each([
    [0, "0 props"],
    [1, "1 prop"],
    [3, "3 props"],
  ])("labels %i as %s", (count, label) => {
    expect(propCountLabel(count)).toBe(label);
  });
});
