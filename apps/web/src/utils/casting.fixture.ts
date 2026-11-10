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
