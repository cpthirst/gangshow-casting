import type { CastMember, Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import { castBySection, partsByMember, spokenParts } from "./overview.ts";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
let nextId = 1;
const person = (
  firstName: string,
  lastName: string,
  section: CastMember["section"],
): CastMember => ({ id: nextId++, firstName, lastName, section, group: "", revision: 1 });

const shape = (sections: ReturnType<typeof castBySection>) =>
  sections.map(({ label, members }) => [label, members.map((m) => m.firstName)]);

describe("castBySection", () => {
  it("groups people as Scouts, Explorers, Network, then Not set", () => {
    const cast = [
      person("Jo", "Newcomer", null),
      person("Kit", "Person", "network"),
      person("Alex", "Sample", "explorers"),
      person("Sam", "Example", "scouts"),
    ];

    expect(shape(castBySection(cast))).toEqual([
      ["Scouts", ["Sam"]],
      ["Explorers", ["Alex"]],
      ["Network", ["Kit"]],
      ["Not set", ["Jo"]],
    ]);
  });

  it("leaves out sections with nobody in them", () => {
    const cast = [person("Sam", "Example", "scouts"), person("Jo", "Newcomer", null)];

    expect(castBySection(cast).map((section) => section.label)).toEqual(["Scouts", "Not set"]);
  });

  it("lists each section by last name, then first name, for now", () => {
    const cast = [
      person("Ben", "Carter", "scouts"),
      person("Zoe", "Adams", "scouts"),
      person("Amy", "Carter", "scouts"),
    ];

    expect(shape(castBySection(cast))).toEqual([["Scouts", ["Zoe", "Amy", "Ben"]]]);
  });

  it("has no sections for an empty cast", () => {
    expect(castBySection([])).toEqual([]);
  });
});

describe("partsByMember", () => {
  let roleId = 1;
  const role = (itemId: string, size: Role["size"], castMemberIds: number[]): Role => ({
    id: roleId,
    itemId,
    name: `Role ${roleId++}`,
    size,
    castMemberIds,
    revision: 1,
  });
  const inShow = new Set(["pirate-sketch", "campfire-song"]);

  it("counts each person's roles by size", () => {
    const roles = [
      role("pirate-sketch", "lead", [12]),
      role("pirate-sketch", "ensemble", [12, 13]),
      role("campfire-song", "ensemble", [12]),
      role("campfire-song", "support", [13]),
    ];

    const parts = partsByMember(roles, inShow);

    expect(parts.get(12)).toEqual({ lead: 1, support: 0, cameo: 0, ensemble: 2 });
    expect(parts.get(13)).toEqual({ lead: 0, support: 1, cameo: 0, ensemble: 1 });
  });

  it("counts two parts in one item twice, and an ensemble once however many are in it", () => {
    const roles = [
      role("pirate-sketch", "lead", [12]),
      role("pirate-sketch", "cameo", [12]),
      role("pirate-sketch", "ensemble", [12, 13, 14, 15, 16]),
    ];

    expect(partsByMember(roles, inShow).get(12)).toEqual({
      lead: 1,
      support: 0,
      cameo: 1,
      ensemble: 1,
    });
  });

  it("only counts roles in items of the saved running order", () => {
    const roles = [role("pirate-sketch", "lead", [12]), role("cut-item", "lead", [12])];

    expect(partsByMember(roles, inShow).get(12)?.lead).toBe(1);
  });

  it("has nothing for someone in no roles", () => {
    expect(partsByMember([], inShow).get(12)).toBeUndefined();
  });
});

describe("spokenParts", () => {
  it("reads the counts in words, biggest size first", () => {
    expect(spokenParts({ lead: 1, support: 0, cameo: 0, ensemble: 3 })).toBe("1 lead, 3 ensemble");
  });
});
