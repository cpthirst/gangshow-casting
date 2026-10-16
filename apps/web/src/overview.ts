import { type CastMember, type Role, RoleSize, type RunningOrder, Section } from "@app/shared";
import { sectionLabel, sortCast } from "./cast.ts";

/** One section of the Overview: its people, in display order. */
export interface OverviewSection {
  key: Section | "not-set";
  label: string;
  members: CastMember[];
}

// Scouts, Explorers, Network, then anyone with no section (casting-overview FR1).
const SECTION_ORDER = [...Section.options, null] as const;

/** The cast grouped by section, empty sections left out. Each section is in surname
 *  order (casting-overview.E2.S2 orders it by casting score instead). */
export function castBySection(members: CastMember[]): OverviewSection[] {
  return SECTION_ORDER.map(
    (section): OverviewSection => ({
      key: section ?? "not-set",
      label: sectionLabel(section),
      members: sortCast(members.filter((member) => member.section === section)),
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
