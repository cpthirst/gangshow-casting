import type { CastMember } from "@app/shared";
import { describe, expect, it } from "vitest";
import { type CastFilters, filterCast, NO_FILTERS } from "./cast.ts";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
let nextId = 1;
const member = (firstName: string, lastName: string, section: CastMember["section"]) => ({
  id: nextId++,
  firstName,
  lastName,
  section,
  group: "",
  revision: 1,
});

const cast: CastMember[] = [
  member("Sam", "Example", "scouts"),
  member("Samira", "Sample", "explorers"),
  member("Zoë", "Other", null),
];
const names = (members: CastMember[]) => members.map((m) => `${m.firstName} ${m.lastName}`);
const filter = (filters: Partial<CastFilters>) =>
  names(filterCast(cast, { ...NO_FILTERS, ...filters }));

describe("filterCast", () => {
  it("keeps everyone with no filters", () => {
    expect(filter({})).toHaveLength(3);
  });

  it("matches any part of the first name, ignoring case", () => {
    expect(filter({ firstName: "AM" })).toEqual(["Sam Example", "Samira Sample"]);
  });

  it("matches any part of the last name", () => {
    expect(filter({ lastName: "ampl" })).toEqual(["Sam Example", "Samira Sample"]);
  });

  it("ignores accents on either side", () => {
    expect(filter({ firstName: "zoe" })).toEqual(["Zoë Other"]);
    expect(filter({ firstName: "zoë" })).toEqual(["Zoë Other"]);
  });

  it("ignores surrounding spaces in what's typed", () => {
    expect(filter({ firstName: "  sam " })).toEqual(["Sam Example", "Samira Sample"]);
  });

  it("filters by section, including members with no section", () => {
    expect(filter({ section: "explorers" })).toEqual(["Samira Sample"]);
    expect(filter({ section: "not-set" })).toEqual(["Zoë Other"]);
  });

  it("combines filters", () => {
    expect(filter({ firstName: "sam", section: "scouts" })).toEqual(["Sam Example"]);
  });
});
