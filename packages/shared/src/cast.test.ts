import { describe, expect, it } from "vitest";
import { CastList, CastMember, CastMemberDetails, UpdateCastMemberRequest } from "./cast.ts";

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

  it("may hold short Singing and Acting notes, trimmed (ADR 0014)", () => {
    const parsed = CastMember.parse({ ...sam, singing: " Strong alto ", acting: "Comic timing" });

    expect([parsed.singing, parsed.acting]).toEqual(["Strong alto", "Comic timing"]);
  });

  it("loads a member saved before the notes existed, with no notes", () => {
    const parsed = CastMember.parse(sam);

    expect([parsed.singing, parsed.acting]).toEqual([undefined, undefined]);
  });

  it.each(["singing", "acting"])("accepts a %s note of exactly 100 characters", (field) => {
    expect(CastMember.safeParse({ ...sam, [field]: "x".repeat(100) }).success).toBe(true);
  });

  it.each(["singing", "acting"])("rejects a %s note over 100 characters", (field) => {
    expect(CastMember.safeParse({ ...sam, [field]: "x".repeat(101) }).success).toBe(false);
    expect(
      CastMemberDetails.safeParse({
        firstName: "Jo",
        lastName: "Newcomer",
        section: null,
        group: "",
        [field]: "x".repeat(101),
      }).success,
    ).toBe(false);
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

describe("CastMemberDetails", () => {
  const details = { firstName: "Jo", lastName: "Newcomer", section: null, group: "" };

  it("accepts the editable details of a cast member", () => {
    expect(CastMemberDetails.parse(details)).toEqual(details);
  });

  it("trims names", () => {
    expect(CastMemberDetails.parse({ ...details, firstName: "  Jo " }).firstName).toBe("Jo");
  });

  it.each([
    ["an id (the app assigns it)", { id: 9 }],
    ["a revision", { revision: 1 }],
    ["a date of birth", { dateOfBirth: "2012-01-01" }],
  ])("rejects %s", (_case, extra) => {
    expect(CastMemberDetails.safeParse({ ...details, ...extra }).success).toBe(false);
  });
});

describe("UpdateCastMemberRequest", () => {
  const update = {
    firstName: "Sam",
    lastName: "Example",
    section: "explorers",
    group: "Riverside ESU",
    revision: 3,
  };

  it("accepts new details with the revision they were based on", () => {
    expect(UpdateCastMemberRequest.parse(update)).toEqual(update);
  });

  it.each([
    ["no revision", { revision: undefined }],
    ["an id (it comes from the URL and can't change)", { id: 99 }],
    ["an empty last name", { lastName: "" }],
  ])("rejects %s", (_case, change) => {
    expect(UpdateCastMemberRequest.safeParse({ ...update, ...change }).success).toBe(false);
  });
});
