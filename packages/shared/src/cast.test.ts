import { describe, expect, it } from "vitest";
import { CastList, CastMember } from "./cast.ts";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
const sam = {
  id: 1,
  firstName: "Sam",
  lastName: "Example",
  section: "scouts",
  group: "1st Somewhere",
  revision: 1,
};

describe("CastMember", () => {
  it("accepts a cast member", () => {
    expect(CastMember.parse(sam)).toEqual(sam);
  });

  it("accepts a member with no section and no group", () => {
    expect(CastMember.parse({ ...sam, section: null, group: "" }).section).toBeNull();
  });

  it.each([
    ["an empty first name", { firstName: "  " }],
    ["an empty last name", { lastName: "" }],
    ["a first name over 40 characters", { firstName: "x".repeat(41) }],
    ["a group over 60 characters", { group: "x".repeat(61) }],
    ["a section outside the list", { section: "beavers" }],
    ["a non-numeric id", { id: "1" }],
  ])("rejects %s", (_case, change) => {
    expect(CastMember.safeParse({ ...sam, ...change }).success).toBe(false);
  });

  it("rejects any personal data beyond the agreed fields (ADR 0010)", () => {
    expect(CastMember.safeParse({ ...sam, dateOfBirth: "2012-01-01" }).success).toBe(false);
  });
});

describe("CastList", () => {
  it("accepts a production's cast", () => {
    const list = { productionId: "2027", members: [sam] };
    expect(CastList.parse(list)).toEqual(list);
  });

  it("rejects an unsafe production id", () => {
    expect(CastList.safeParse({ productionId: "../x", members: [] }).success).toBe(false);
  });
});
