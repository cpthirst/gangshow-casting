import { type CastMember, type Role, RoleSize, type RunningOrder, Section } from "@app/shared";
import { sectionLabel, sortCast } from "./cast.ts";
import { biggerPart } from "./roles.ts";
import { runningClock } from "./running-order.ts";

/** One section of the Overview: its people, in display order. */
export interface OverviewSection {
  key: Section | "not-set";
  label: string;
  members: CastMember[];
}

// Scouts, Explorers, Network, then anyone with no section (casting-overview FR1).
const SECTION_ORDER = [...Section.options, null] as const;

/** The cast grouped by section, empty sections left out. Each section is ordered by
 *  casting score once the parts are known (casting-overview FR3–FR5), else by surname. */
export function castBySection(
  members: CastMember[],
  parts?: ReadonlyMap<number, PartCounts>,
): OverviewSection[] {
  const order = (group: CastMember[]) => (parts ? byCastingScore(group, parts) : sortCast(group));
  return SECTION_ORDER.map(
    (section): OverviewSection => ({
      key: section ?? "not-set",
      label: sectionLabel(section),
      members: order(members.filter((member) => member.section === section)),
    }),
  ).filter((group) => group.members.length > 0);
}

/** "3 people", "1 person". */
export const peopleCount = (count: number) => `${count} ${count === 1 ? "person" : "people"}`;

/** How many roles of each size a person has. */
export type PartCounts = Record<RoleSize, number>;

const noParts = (): PartCounts => ({ lead: 0, support: 0, cameo: 0, ensemble: 0 });

/** Each cast member's roles counted by size (casting-overview FR2, FR6): every role they're
 *  in counts once, so two parts in one item count twice and an ensemble counts once.
 *  Only roles in items of the latest saved running order count (FR7). Someone in no
 *  counted roles has no entry. */
export function partsByMember(
  roles: Role[],
  itemsInShow: ReadonlySet<string>,
): Map<number, PartCounts> {
  const parts = new Map<number, PartCounts>();
  for (const role of roles) {
    if (!itemsInShow.has(role.itemId)) continue;
    for (const id of role.castMemberIds) {
      const counts = parts.get(id) ?? noParts();
      counts[role.size] += 1;
      parts.set(id, counts);
    }
  }
  return parts;
}

/** The sizes someone has, biggest first, with their counts: what the pills show. */
export const sizesHeld = (counts: PartCounts) =>
  RoleSize.options
    .filter((size) => counts[size] > 0)
    .map((size) => ({ size, count: counts[size] }));

/** "1 lead, 3 ensemble": the pills as a screen reader should hear them. */
export const spokenParts = (counts: PartCounts) =>
  sizesHeld(counts)
    .map(({ size, count }) => `${count} ${size}`)
    .join(", ");

/** The ids of the items in a saved running order: the only items whose roles count. */
export const itemIdsInOrder = (order: RunningOrder) =>
  new Set(order.halves.flatMap((half) => half.items.map((item) => item.id)));

/** Points per role, by size: one lead (8) outweighs two supports (6) or three cameos (6),
 *  but three supports (9) outweigh one lead. Agreed in the casting-overview PRD (FR3). */
const POINTS: Record<RoleSize, number> = { lead: 8, support: 3, cameo: 2, ensemble: 1 };

/** A person's casting score: the points for every role they're in. Used only to order the
 *  Overview, never shown. */
export const castingScore = (counts: PartCounts) =>
  RoleSize.options.reduce((score, size) => score + counts[size] * POINTS[size], 0);

const totalRoles = (counts: PartCounts) =>
  RoleSize.options.reduce((total, size) => total + counts[size], 0);

/** Highest casting score first, then more roles, then surname order (FR3, FR4). People with
 *  no parts score 0 with 0 roles, so they end up last (FR5). */
function byCastingScore(members: CastMember[], parts: ReadonlyMap<number, PartCounts>) {
  const countsOf = (member: CastMember) => parts.get(member.id) ?? noParts();
  // Sorting is stable, so starting from surname order keeps it for equal scores and roles.
  return sortCast(members).sort((a, b) => {
    const [first, second] = [countsOf(a), countsOf(b)];
    return castingScore(second) - castingScore(first) || totalRoles(second) - totalRoles(first);
  });
}

/** Each person's biggest part in each item they're in: person → item id → part. */
export function biggestParts(roles: Role[]) {
  const parts = new Map<number, Map<string, RoleSize>>();
  for (const role of roles) {
    for (const id of role.castMemberIds) {
      const theirs = parts.get(id) ?? new Map<string, RoleSize>();
      const part = theirs.get(role.itemId);
      theirs.set(role.itemId, part ? biggerPart(part, role.size) : role.size);
      parts.set(id, theirs);
    }
  }
  return parts;
}

/** One item on a person's timeline: their biggest part in it, if they're in it. */
export interface TimelineSlot {
  itemId: string;
  title: string;
  /** Programme number; null for an item left out of the printed programme. */
  number: number | null;
  part: RoleSize | undefined;
}

/** A person's evening, half by half, one slot per item in show order (casting-overview-
 *  timeline FR1–FR4). Every item counts, printed or not. */
export const timelineOf = (
  order: RunningOrder,
  theirParts: ReadonlyMap<string, RoleSize> | undefined,
): TimelineSlot[][] =>
  runningClock(order).halves.map(({ rows }) =>
    rows.map(({ item, number }) => ({
      itemId: item.id,
      title: item.title,
      number,
      part: theirParts?.get(item.id),
    })),
  );
