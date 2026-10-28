import type { CastList, CastMember, CastMemberDetails } from "@app/shared";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
export const aCastMember = (id: number, details: Partial<CastMember> = {}): CastMember => ({
  id,
  firstName: "Sam",
  lastName: "Example",
  section: "scouts",
  group: "1st Somewhere",
  revision: 1,
  ...details,
});

/** A new member's details, as the add form sends them. */
export const jo: CastMemberDetails = {
  firstName: "Jo",
  lastName: "Newcomer",
  section: null,
  group: "",
};

export const aCastList = (members: CastMember[], productionId = "2027"): CastList => ({
  productionId,
  members,
});
