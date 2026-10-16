import type { CastMember, Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import { remainingCast, roleDetailsFrom, roleSizeLabel, sortRoles } from "./roles.ts";

const noneTaken = { itemTitle: "Pirate Sketch", names: [] };
const nobody = { query: "", id: null };

describe("roleDetailsFrom", () => {
  it("gives the role's details, trimming the name", () => {
    expect(
      roleDetailsFrom({ name: "  Captain Hook ", size: "lead", castMember: nobody }, noneTaken),
    ).toEqual({
      ok: true,
      details: { name: "Captain Hook", size: "lead", castMemberIds: [] },
    });
  });

  it.each([
    ["an empty name", "", "Enter a role name"],
    ["a name of only spaces", "   ", "Enter a role name"],
    ["a name over 60 characters", "x".repeat(61), "Role names can be up to 60 characters"],
  ])("explains %s", (_case, name, message) => {
    expect(roleDetailsFrom({ name, size: "lead", castMember: nobody }, noneTaken)).toEqual({
      ok: false,
      errors: { name: message },
    });
  });

  it("asks for a role size when none is chosen", () => {
    expect(
      roleDetailsFrom({ name: "Captain Hook", size: "", castMember: nobody }, noneTaken),
    ).toEqual({
      ok: false,
      errors: { size: "Choose a role size" },
    });
  });
});

describe("roleSizeLabel", () => {
  it.each([
    ["lead", "Lead"],
    ["support", "Support"],
    ["cameo", "Cameo"],
    ["ensemble", "Ensemble"],
  ] as const)("labels %s as %s", (size, label) => {
    expect(roleSizeLabel(size)).toBe(label);
  });
});

describe("roleDetailsFrom with the item's existing roles", () => {
  const taken = { itemTitle: "Pirate Sketch", names: ["Captain Hook"] };

  it("refuses a name the item already has, ignoring case and spaces", () => {
    expect(
      roleDetailsFrom({ name: " captain hook ", size: "cameo", castMember: nobody }, taken),
    ).toEqual({
      ok: false,
      errors: { name: "Pirate Sketch already has a role called Captain Hook" },
    });
  });

  it("allows a new name", () => {
    expect(roleDetailsFrom({ name: "Smee", size: "support", castMember: nobody }, taken).ok).toBe(
      true,
    );
  });
});

describe("roleDetailsFrom with a cast member", () => {
  it("casts the chosen member", () => {
    const form = {
      name: "Captain Hook",
      size: "lead" as const,
      castMember: { query: "Sam Example", id: 12 },
    };

    expect(roleDetailsFrom(form, noneTaken)).toEqual({
      ok: true,
      details: { name: "Captain Hook", size: "lead", castMemberIds: [12] },
    });
  });

  it("refuses typed text that wasn't chosen from the list", () => {
    const form = {
      name: "Captain Hook",
      size: "lead" as const,
      castMember: { query: "sam", id: null },
    };

    expect(roleDetailsFrom(form, noneTaken)).toEqual({
      ok: false,
      errors: { castMember: "Choose a cast member from the list, or clear the field" },
    });
  });

  it("adds the role uncast when the field is left blank", () => {
    const form = {
      name: "Captain Hook",
      size: "lead" as const,
      castMember: { query: "  ", id: null },
    };

    expect(roleDetailsFrom(form, noneTaken)).toMatchObject({
      ok: true,
      details: { castMemberIds: [] },
    });
  });
});

describe("sortRoles", () => {
  const role = (name: string, size: Role["size"]): Role => ({
    id: 1,
    itemId: "pirate-sketch",
    name,
    size,
    castMemberIds: [],
    revision: 1,
  });

  it("puts bigger roles first, then sorts by name ignoring case", () => {
    const sorted = sortRoles([
      role("Pirates", "ensemble"),
      role("smee", "support"),
      role("Parrot", "cameo"),
      role("Bosun", "support"),
      role("Captain Hook", "lead"),
    ]);

    expect(sorted.map((r) => r.name)).toEqual([
      "Captain Hook",
      "Bosun",
      "smee",
      "Parrot",
      "Pirates",
    ]);
  });

  it("leaves the roles it was given in their original order", () => {
    const roles = [role("Pirates", "ensemble"), role("Captain Hook", "lead")];

    sortRoles(roles);

    expect(roles.map((r) => r.name)).toEqual(["Pirates", "Captain Hook"]);
  });
});

describe("roleDetailsFrom for an ensemble's members", () => {
  const ensemble = (size: Role["size"], members: number[]) => ({
    name: "Pirates",
    size,
    castMember: { query: "", id: null },
    members,
  });

  it("casts every member listed", () => {
    expect(roleDetailsFrom(ensemble("ensemble", [12, 13]), noneTaken)).toEqual({
      ok: true,
      details: { name: "Pirates", size: "ensemble", castMemberIds: [12, 13] },
    });
  });

  it("refuses a single-person size while several people are in it", () => {
    expect(roleDetailsFrom(ensemble("cameo", [12, 13]), noneTaken)).toEqual({
      ok: false,
      errors: { size: "Leave one person in this ensemble before making it a Cameo role" },
    });
  });

  it("allows a single-person size once one person is left", () => {
    expect(roleDetailsFrom(ensemble("cameo", [12]), noneTaken)).toMatchObject({
      ok: true,
      details: { size: "cameo", castMemberIds: [12] },
    });
  });
});

describe("roleDetailsFrom for a very big ensemble", () => {
  it("explains that an ensemble holds at most 200 people", () => {
    const members = Array.from({ length: 201 }, (_, i) => i + 1);

    expect(
      roleDetailsFrom({ name: "Crowd", size: "ensemble", castMember: nobody, members }, noneTaken),
    ).toEqual({
      ok: false,
      errors: { castMember: "An ensemble can hold up to 200 people. Remove some to save it." },
    });
  });
});

describe("remainingCast", () => {
  // Made-up names only (CLAUDE.md safeguarding).
  const member = (id: number, firstName: string, lastName: string): CastMember => ({
    id,
    firstName,
    lastName,
    section: null,
    group: "",
    revision: 1,
  });
  const cast = [
    member(1, "Sam", "Example"),
    member(2, "Alex", "Sample"),
    member(3, "Jo", "Newcomer"),
    member(4, "Zoë", "Adams"),
  ];

  it("is everyone not in another role in the item, nor already in the ensemble", () => {
    // Sam is in another role; Alex is already in the ensemble.
    expect(remainingCast(cast, [1], [2])).toEqual([4, 3]);
  });

  it("is nobody when everyone is already in a role in the item", () => {
    expect(remainingCast(cast, [1, 2], [3, 4])).toEqual([]);
  });
});
