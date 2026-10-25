import { describe, expect, it } from "vitest";
import { AddPropRequest, MAX_PROP_NAME_LENGTH, Prop, PropList } from "./prop.ts";

const aProp = (id: number, itemId: string, name = `Prop ${id}`) => ({ id, itemId, name });

describe("Prop", () => {
  it("is a named prop in one item", () => {
    const prop = aProp(1, "pirate-sketch", "Treasure chest");
    expect(Prop.parse(prop)).toEqual(prop);
  });

  it("refuses unknown fields, so it can't carry cast data", () => {
    expect(Prop.safeParse({ ...aProp(1, "pirate-sketch"), castMemberIds: [1] }).success).toBe(
      false,
    );
  });

  it("needs a name", () => {
    expect(Prop.safeParse(aProp(1, "pirate-sketch", "  ")).success).toBe(false);
  });
});

describe("PropList", () => {
  it("is a production's props", () => {
    expect(PropList.parse({ productionId: "2027", props: [] })).toEqual({
      productionId: "2027",
      props: [],
    });
  });
});

describe("AddPropRequest", () => {
  it("is a prop's name, trimmed", () => {
    expect(AddPropRequest.parse({ name: " Treasure chest " })).toEqual({ name: "Treasure chest" });
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
  ])("refuses a name that's %s", (_case, name) => {
    expect(AddPropRequest.safeParse({ name }).success).toBe(false);
  });

  it("refuses a name over the longest a prop's name can be", () => {
    expect(AddPropRequest.safeParse({ name: "x".repeat(MAX_PROP_NAME_LENGTH + 1) }).success).toBe(
      false,
    );
  });

  it("refuses the app-managed id and item, and unknown fields", () => {
    for (const extra of [{ id: 1 }, { itemId: "finale" }, { castMemberIds: [1] }]) {
      expect(AddPropRequest.safeParse({ name: "Parrot", ...extra }).success).toBe(false);
    }
  });
});
