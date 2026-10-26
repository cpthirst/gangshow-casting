import type { Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import {
  type PropFormFields,
  propCountLabel,
  propCounts,
  propDetailsFrom,
  rolesOf,
  sortProps,
} from "./props.ts";

const aProp = (id: number, itemId: string, roleIds: number[] = []) => ({
  id,
  itemId,
  name: `Prop ${id}`,
  roleIds,
});

const aRole = (id: number, name: string, size: Role["size"]): Role => ({
  id,
  itemId: "pirate-sketch",
  name,
  size,
  castMemberIds: [],
  revision: 1,
});

/** The prop form as typed: a name, and no roles unless given. */
const fields = (name: string, more: Partial<PropFormFields> = {}): PropFormFields => ({
  name,
  role: { query: "", id: null },
  roleIds: [],
  ...more,
});

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
      { id: 1, itemId: "pirate-sketch", name: "umbrella 10", roleIds: [] },
      { id: 2, itemId: "pirate-sketch", name: "Treasure chest", roleIds: [] },
      { id: 3, itemId: "pirate-sketch", name: "Umbrella 2", roleIds: [] },
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
    expect(propDetailsFrom(fields(" Parrot "))).toEqual({
      ok: true,
      details: { name: "Parrot", roleIds: [] },
    });
  });

  it("gives the roles picked", () => {
    expect(propDetailsFrom(fields("Telescope", { roleIds: [3, 1] }))).toEqual({
      ok: true,
      details: { name: "Telescope", roleIds: [3, 1] },
    });
  });

  it("says a role typed but not chosen from the list must be chosen or cleared", () => {
    expect(propDetailsFrom(fields("Telescope", { role: { query: "capt", id: null } }))).toEqual({
      ok: false,
      errors: { role: "Choose a role from the list, or clear the field" },
    });
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
  ])("says a prop needs a name when it's %s", (_case, name) => {
    expect(propDetailsFrom(fields(name))).toEqual({
      ok: false,
      errors: { name: "A prop needs a name" },
    });
  });

  it("says how long a prop's name can be", () => {
    expect(propDetailsFrom(fields("x".repeat(81)))).toEqual({
      ok: false,
      errors: { name: "Prop names can be up to 80 characters" },
    });
  });
});

describe("rolesOf", () => {
  const captain = aRole(1, "Captain", "lead");
  const pirate1 = aRole(2, "Pirate 1", "support");

  it("gives the prop's roles in the item's role order, leads first", () => {
    expect(
      rolesOf(aProp(1, "pirate-sketch", [pirate1.id, captain.id]), [pirate1, captain]),
    ).toEqual([captain, pirate1]);
  });

  it("leaves out a role that's been removed", () => {
    expect(rolesOf(aProp(1, "pirate-sketch", [captain.id, pirate1.id]), [pirate1])).toEqual([
      pirate1,
    ]);
  });
});
