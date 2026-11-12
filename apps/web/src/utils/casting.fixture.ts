import type { CastMember, Role } from "@app/shared";

// Made-up data only: tests never use the real cast (CLAUDE.md safeguarding).

/** Someone on the cast list, named after their id: "Member 3 Example". */
export const aCastMember = (id: number, details: Partial<CastMember> = {}): CastMember => ({
  id,
  firstName: `Member ${id}`,
  lastName: "Example",
  section: null,
  group: "",
  revision: 1,
  ...details,
});

/** A part in an item, an ensemble unless given a size, played by those listed. */
export const aRole = (
  id: number,
  itemId: string,
  castMemberIds: number[],
  details: Partial<Role> = {},
): Role => ({
  id,
  itemId,
  name: `Role ${id}`,
  size: "ensemble",
  castMemberIds,
  revision: 1,
  ...details,
});

/** Ids from `from` to `to`, inclusive: the cast members in an ensemble. */
export const ids = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** A made-up crew for Opening Number, as the costume stories name them. */
export const alexMorgan = aCastMember(1, { firstName: "Alex", lastName: "Morgan" });
export const joBrown = aCastMember(2, { firstName: "Jo", lastName: "Brown" });
export const kimLee = aCastMember(3, { firstName: "Kim", lastName: "Lee" });
export const samPatel = aCastMember(4, { firstName: "Sam", lastName: "Patel" });
export const chrisEvans = aCastMember(5, { firstName: "Chris", lastName: "Evans" });
export const pirateCast = [alexMorgan, joBrown, kimLee, samPatel, chrisEvans];

/** Opening Number's lead, Captain Hook, played by Alex Morgan unless recast. */
export const captainHook = (playedBy = alexMorgan) =>
  aRole(1, "opening-number", [playedBy.id], { name: "Captain Hook", size: "lead" });

/** Opening Number's Pirates ensemble, held out of surname order so a test sees them sorted. */
export const pirates = aRole(2, "opening-number", [samPatel.id, joBrown.id, kimLee.id], {
  name: "Pirates",
});

/** Opening Number's Smee, with nobody cast in it. */
export const smee = aRole(3, "opening-number", [], { name: "Smee", size: "support" });
