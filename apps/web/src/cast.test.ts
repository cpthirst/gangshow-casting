import type { CastMember } from "@app/shared";
import { describe, expect, it } from "vitest";
import { type CastFilters, type CastForm, detailsFrom, filterCast, NO_FILTERS } from "./cast.ts";

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

describe("detailsFrom", () => {
  const form: CastForm = { firstName: "Jo", lastName: "Newcomer", section: "", group: "" };

  it("turns a filled form into cast member details, trimmed, with blank section as not set", () => {
    expect(detailsFrom({ ...form, firstName: " Jo ", section: "scouts" })).toEqual({
      ok: true,
      details: { firstName: "Jo", lastName: "Newcomer", section: "scouts", group: "" },
    });
    expect(detailsFrom(form)).toEqual({
      ok: true,
      details: { firstName: "Jo", lastName: "Newcomer", section: null, group: "" },
    });
  });

  const badInput: [keyof CastForm, Partial<CastForm>, string][] = [
    ["firstName", { firstName: "  " }, "Enter a first name"],
    ["lastName", { lastName: "" }, "Enter a last name"],
    ["firstName", { firstName: "x".repeat(41) }, "Keep the first name to 40 characters or fewer"],
    ["lastName", { lastName: "x".repeat(41) }, "Keep the last name to 40 characters or fewer"],
    ["group", { group: "x".repeat(61) }, "Keep the group to 60 characters or fewer"],
  ];

  it.each(badInput)("explains a bad %s", (field, change, message) => {
    const result = detailsFrom({ ...form, ...change });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[field]).toBe(message);
  });
});
