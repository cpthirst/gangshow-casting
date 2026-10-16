import type { Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import { roleDetailsFrom, roleSizeLabel, sortRoles } from "./roles.ts";

const noneTaken = { itemTitle: "Pirate Sketch", names: [] };

describe("roleDetailsFrom", () => {
  it("gives the role's details, trimming the name", () => {
    expect(roleDetailsFrom({ name: "  Captain Hook ", size: "lead" }, noneTaken)).toEqual({
      ok: true,
      details: { name: "Captain Hook", size: "lead" },
    });
  });

  it.each([
    ["an empty name", "", "Enter a role name"],
    ["a name of only spaces", "   ", "Enter a role name"],
    ["a name over 60 characters", "x".repeat(61), "Role names can be up to 60 characters"],
  ])("explains %s", (_case, name, message) => {
    expect(roleDetailsFrom({ name, size: "lead" }, noneTaken)).toEqual({
      ok: false,
      errors: { name: message },
    });
  });

  it("asks for a role size when none is chosen", () => {
    expect(roleDetailsFrom({ name: "Captain Hook", size: "" }, noneTaken)).toEqual({
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
    expect(roleDetailsFrom({ name: " captain hook ", size: "cameo" }, taken)).toEqual({
      ok: false,
      errors: { name: "Pirate Sketch already has a role called Captain Hook" },
    });
  });

  it("allows a new name", () => {
    expect(roleDetailsFrom({ name: "Smee", size: "support" }, taken).ok).toBe(true);
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
