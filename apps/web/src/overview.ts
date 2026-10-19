import {
  type CastMember,
  type GridSection,
  type Role,
  RoleSize,
  type RunningOrder,
  Section,
} from "@app/shared";
import { sectionLabel, sortCast } from "./cast.ts";
import type { ClashLine } from "./clashes.ts";
import { biggerPart, roleSizeLabel, sortRoles } from "./roles.ts";
import { runningClock } from "./running-order.ts";

/** One section of the Overview: its people, in display order. */
export interface OverviewSection {
  key: Section | "not-set";
  label: GridSection;
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

/** The sizes in the headline totals: ensemble is left out (casting-overview-grid FR3). */
const TOTAL_SIZES = ["lead", "support", "cameo"] as const;

/** How many roles of each headline size the show has, cast or not (casting-overview-grid
 *  FR1, FR2). Like parts, only roles in items of the saved running order count. */
export const roleTotals = (roles: Role[], itemsInShow: ReadonlySet<string>) =>
  TOTAL_SIZES.map((size) => ({
    size,
    count: roles.filter((role) => role.size === size && itemsInShow.has(role.itemId)).length,
  }));

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

/** What a dot stands for, on hover (FR5): "3 · Dance One: Support", or "1 · Opening Number"
 *  when they're not in it. Plain text, never HTML. */
export function dotLabel({ title, number, part }: TimelineSlot) {
  const item = number === null ? `${title} (not in printed programme)` : `${number} · ${title}`;
  return part ? `${item}: ${roleSizeLabel(part)}` : item;
}

/** One item as a grid column: its programme number (null if not printed) and its half (1 or 2). */
export interface GridColumn {
  itemId: string;
  title: string;
  number: number | null;
  halfNumber: number;
}

/** The grid's columns: every item in show order, so they line up with each person's
 *  `timelineOf` slots. */
export const gridColumns = (order: RunningOrder): GridColumn[] =>
  runningClock(order).halves.flatMap(({ rows }, half) =>
    rows.map(({ item, number }) => ({
      itemId: item.id,
      title: item.title,
      number,
      halfNumber: half + 1,
    })),
  );

/** One person's row in the grid: who they are and a slot for every column. */
export interface GridRow {
  id: number;
  firstName: string;
  lastName: string;
  section: GridSection;
  clashLines: ClashLine[];
  slots: TimelineSlot[];
}

const MAX_TITLE = 15;

/** A title cut to 15 characters with "..." after, if it is longer (casting-overview-grid FR10):
 *  a grid column should be about as wide as a dot, not as its longest title. */
export const shortTitle = (title: string) =>
  title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE)}...` : title;

const headingOf = ({ number, halfNumber }: GridColumn, title: string) =>
  number === null ? title : `${halfNumber}.${number} · ${title}`;

/** A grid column's heading: "2.4 · Finale", the half then the programme number in it, which
 *  restarts each half. An item left out of the printed programme has no number: the page
 *  shows it in italic red. A long title is cut short. */
export const gridHeading = (column: GridColumn) => headingOf(column, shortTitle(column.title));

/** The same heading with the whole title: for hover. */
export const fullGridHeading = (column: GridColumn) => headingOf(column, column.title);

/** What a screen reader hears: the whole heading, and that an unprinted item is one, since
 *  italic red alone says nothing to it. */
export const spokenGridHeading = (column: GridColumn) =>
  column.number === null
    ? `${fullGridHeading(column)}, not in printed programme`
    : fullGridHeading(column);

/** A timeline as one sentence for screen readers (FR6): "In 2 of 5 items: Pirate Sketch,
 *  Finale", or "In none of the 5 items". */
export function timelineSummary(halves: TimelineSlot[][]) {
  const slots = halves.flat();
  const total = `${slots.length} item${slots.length === 1 ? "" : "s"}`;
  const theirs = slots.filter((slot) => slot.part).map((slot) => slot.title);
  return theirs.length === 0
    ? `In none of the ${total}`
    : `In ${theirs.length} of ${total}: ${theirs.join(", ")}`;
}

/** One role as the By item view lists it: who plays it, in surname order. */
export interface ItemRole {
  id: number;
  name: string;
  size: RoleSize;
  cast: { id: number; name: string }[];
}

/** One item in the By item view: its programme number (null if not printed) and roles. */
export interface ShowItem {
  itemId: string;
  title: string;
  number: number | null;
  roles: ItemRole[];
}

/** An item's heading on the By item view and in its document: "2 Campfire Song", or only the
 *  title for an item left out of the printed programme. */
export const itemHeading = ({ number, title }: Pick<ShowItem, "number" | "title">) =>
  number === null ? title : `${number} ${title}`;

/** One half of the show in the By item view: its id, name and items in show order. */
export interface ShowHalf {
  id: string;
  name: string;
  items: ShowItem[];
}

/** The whole show item by item (casting-overview-by-item FR2, FR4): each half's items in show
 *  order, each with its roles ordered as on the item's page and the names of who plays them. */
export function showByItem(order: RunningOrder, roles: Role[], cast: CastMember[]): ShowHalf[] {
  const castOf = (role: Role) =>
    sortCast(cast.filter((member) => role.castMemberIds.includes(member.id))).map((member) => ({
      id: member.id,
      name: `${member.firstName} ${member.lastName}`,
    }));
  return runningClock(order).halves.map(({ half, rows }) => ({
    id: half.id,
    name: half.name,
    items: rows.map(
      ({ item, number }): ShowItem => ({
        itemId: item.id,
        title: item.title,
        number,
        roles: sortRoles(roles.filter((role) => role.itemId === item.id)).map((role) => ({
          id: role.id,
          name: role.name,
          size: role.size,
          cast: castOf(role),
        })),
      }),
    ),
  }));
}
