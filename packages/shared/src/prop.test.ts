import { describe, expect, it } from "vitest";
import { AddPropRequest, MAX_PROP_NAME_LENGTH, Prop, PropList } from "./prop.ts";

const aProp = (id: number, itemId: string, name = `Prop ${id}`) => ({
  id,
  itemId,
  name,
  roleIds: [],
});

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

  it("links to roles by id, never to cast members", () => {
    const prop = { ...aProp(1, "pirate-sketch", "Telescope"), roleIds: [3, 5] };
    expect(Prop.parse(prop)).toEqual(prop);
  });

  it("has no roles when it was saved before props had roles", () => {
    expect(Prop.parse({ id: 1, itemId: "pirate-sketch", name: "Telescope" }).roleIds).toEqual([]);
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
  it("is a prop's name, trimmed, with no roles unless given", () => {
    expect(AddPropRequest.parse({ name: " Treasure chest " })).toEqual({
      name: "Treasure chest",
      roleIds: [],
    });
  });

  it("takes the ids of the roles that use the prop", () => {
    expect(AddPropRequest.parse({ name: "3 umbrellas", roleIds: [1, 2, 3] }).roleIds).toEqual([
      1, 2, 3,
    ]);
  });

  it("refuses a role listed twice", () => {
    expect(AddPropRequest.safeParse({ name: "Telescope", roleIds: [1, 1] }).success).toBe(false);
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
