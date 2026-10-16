import type { CastMember } from "@app/shared";
import { describe, expect, it } from "vitest";
import { castBySection } from "./overview.ts";

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
