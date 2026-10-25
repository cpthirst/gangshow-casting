import { describe, expect, it } from "vitest";
import { propCountLabel, propCounts, propDetailsFrom, sortProps } from "./props.ts";

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

describe("sortProps", () => {
  it("orders props by name, ignoring case and comparing numbers by value", () => {
    const props = [
      { id: 1, itemId: "pirate-sketch", name: "umbrella 10" },
      { id: 2, itemId: "pirate-sketch", name: "Treasure chest" },
      { id: 3, itemId: "pirate-sketch", name: "Umbrella 2" },
    ];

    expect(sortProps(props).map((prop) => prop.name)).toEqual([
      "Treasure chest",
      "Umbrella 2",
      "umbrella 10",
    ]);
  });
});

describe("propDetailsFrom", () => {
  it("gives the prop's name, trimmed", () => {
    expect(propDetailsFrom({ name: " Parrot " })).toEqual({
      ok: true,
      details: { name: "Parrot" },
    });
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
  ])("says a prop needs a name when it's %s", (_case, name) => {
    expect(propDetailsFrom({ name })).toEqual({
      ok: false,
      errors: { name: "A prop needs a name" },
    });
  });

  it("says how long a prop's name can be", () => {
    expect(propDetailsFrom({ name: "x".repeat(81) })).toEqual({
      ok: false,
      errors: { name: "Prop names can be up to 80 characters" },
    });
  });
});
