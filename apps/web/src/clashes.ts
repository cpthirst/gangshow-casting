import { type CastMember, type Role, RoleSize, type RunningOrder } from "@app/shared";
import { sortCast } from "./cast.ts";
import { roleSizeLabel } from "./roles.ts";

/** How serious a clash can be (casting-rules FR11). Most serious first: `rank` relies on
 *  this order. */
const SEVERITIES = ["error", "warning", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** One of a person's appearances: an item, and their biggest part in it. */
export interface Appearance {
  itemId: string;
  title: string;
  part: RoleSize;
}

/** A problem for one person between two of their appearances, one after the other. */
export interface Clash {
  castMemberId: number;
  kind: "back-to-back" | "timing" | "quick-change";
  severity: Severity;
  first: Appearance;
  second: Appearance;
  /** Minutes off stage between the two: the items between, and the interval if it falls
   *  between them. */
  gapMinutes: number;
}

/** Less time off stage than this is a timing warning (casting-rules FR4)… */
const MIN_GAP = 5;
/** …and less than this is a quick change to plan (FR5). */
const QUICK_CHANGE_GAP = 8;

const severityLabels: Record<Severity, string> = {
  error: "Error",
  warning: "Warning",
  info: "Info",
};

const severityLabel = (severity: Severity) => severityLabels[severity];

// RoleSize is declared biggest first, so a lower index is a bigger part.
const biggest = (a: RoleSize, b: RoleSize) =>
  RoleSize.options.indexOf(a) <= RoleSize.options.indexOf(b) ? a : b;

/** Where an item falls in the show, and when, in minutes from curtain up. */
interface Place {
  position: number;
  halfIndex: number;
  starts: number;
  ends: number;
}

/** Where one of a person's appearances falls in the show. */
type Slot = Appearance & Place;

/** Each item's place in the show, by item id. The interval comes between the halves. */
function placesIn(order: RunningOrder) {
  const places = new Map<string, Place & { title: string }>();
  let clock = 0;
  for (const [halfIndex, half] of order.halves.entries()) {
    if (halfIndex > 0) clock += order.intervalMinutes;
    for (const item of half.items) {
      // Every item is expected to have a length (PRD assumption); a blank adds no time, so a
      // possible clash shows rather than hides.
      const ends = clock + (item.minutes ?? 0);
      places.set(item.id, {
        title: item.title,
        position: places.size,
        halfIndex,
        starts: clock,
        ends,
      });
      clock = ends;
    }
  }
  return places;
}

/** What's wrong between two appearances one after the other, if anything (FR2–FR6). */
function problem(first: Slot, second: Slot): Pick<Clash, "kind" | "severity"> | undefined {
  const isBackToBack =
    second.position === first.position + 1 && second.halfIndex === first.halfIndex;
  // An ensemble's costume and entrances are more flexible (FR3).
  if (isBackToBack)
    return {
      kind: "back-to-back",
      severity: involvesEnsemble(first, second) ? "warning" : "error",
    };
  const gap = gapBetween(first, second);
  if (gap < MIN_GAP) return { kind: "timing", severity: "warning" };
  if (gap < QUICK_CHANGE_GAP) return { kind: "quick-change", severity: "info" };
  return undefined;
}

/** Every clash in the show: each person's appearances in running order, compared one after
 *  the other (casting-rules FR1–FR6). */
export function findClashes(order: RunningOrder, roles: Role[]): Clash[] {
  const shown = placesIn(order);

  // Person → item → where it is and their biggest part in it.
  const slots = new Map<number, Map<string, Slot>>();
  for (const role of roles) {
    const place = shown.get(role.itemId);
    if (!place) continue;
    for (const id of role.castMemberIds) {
      const theirs = slots.get(id) ?? new Map<string, Slot>();
      const part = theirs.get(role.itemId)?.part;
      theirs.set(role.itemId, {
        ...place,
        itemId: role.itemId,
        part: part ? biggest(part, role.size) : role.size,
      });
      slots.set(id, theirs);
    }
  }

  const clashes: Clash[] = [];
  for (const [castMemberId, theirs] of slots) {
    const inOrder = [...theirs.values()].sort((a, b) => a.position - b.position);
    for (const [i, first] of inOrder.entries()) {
      const second = inOrder[i + 1];
      if (!second) continue;
      const found = problem(first, second);
      if (!found) continue;
      clashes.push({
        castMemberId,
        ...found,
        first: appearance(first),
        second: appearance(second),
        gapMinutes: gapBetween(first, second),
      });
    }
  }
  return clashes;
}

const gapBetween = (first: Place, second: Place) => second.starts - first.ends;

const involvesEnsemble = (first: Slot, second: Slot) =>
  first.part === "ensemble" || second.part === "ensemble";

const appearance = ({ itemId, title, part }: Slot): Appearance => ({ itemId, title, part });

const rank = (severity: Severity) => SEVERITIES.indexOf(severity);

// A stable sort: clashes of the same severity stay in running order.
const worstFirst = (clashes: Clash[]) =>
  [...clashes].sort((a, b) => rank(a.severity) - rank(b.severity));

const involves = (clash: Clash, itemId: string) =>
  clash.first.itemId === itemId || clash.second.itemId === itemId;

/** Everyone's clashes that involve an item, worst first (FR8). */
export const clashesInItem = (clashes: Clash[], itemId: string) =>
  worstFirst(clashes.filter((clash) => involves(clash, itemId)));

/** All of a person's clashes in the show, worst first (FR9). */
export const clashesOfPerson = (clashes: Clash[], castMemberId: number) =>
  worstFirst(clashes.filter((clash) => clash.castMemberId === castMemberId));

/** A person's clashes that involve an item, worst first (FR7). */
export const clashesOf = (clashes: Clash[], castMemberId: number, itemId: string) =>
  clashesInItem(clashes, itemId).filter((clash) => clash.castMemberId === castMemberId);

const plurals: Record<Severity, [string, string]> = {
  error: ["error", "errors"],
  warning: ["warning", "warnings"],
  info: ["info", "info"],
};

/** "1 error, 2 warnings: Sam Example, Alex Sample": how many of each severity, then who,
 *  in surname order (FR8). */
export function summariseClashes(clashes: Clash[], cast: CastMember[]) {
  const counts = SEVERITIES.map((severity) => {
    const count = clashes.filter((clash) => clash.severity === severity).length;
    const [one, many] = plurals[severity];
    return count === 0 ? "" : `${count} ${count === 1 ? one : many}`;
  }).filter(Boolean);
  const ids = new Set(clashes.map((clash) => clash.castMemberId));
  const who = sortCast(cast.filter((member) => ids.has(member.id)))
    .map((member) => `${member.firstName} ${member.lastName}`)
    .join(", ");
  // Someone since removed from the cast has no name to give.
  return who ? `${counts.join(", ")}: ${who}` : counts.join(", ");
}

/** One line of a clash icon's description, with the severity that styles it. */
export interface ClashLine {
  severity: Severity;
  text: string;
}

/** Each clash described on its own line, worst first, for a person (item page, Overview). */
export const describeEach = (clashes: Clash[]): ClashLine[] =>
  worstFirst(clashes).map((clash) => ({ severity: clash.severity, text: describeClash(clash) }));

/** What a clash means, as plain text (never HTML) (FR7): the severity, what kind, then
 *  both items, so it reads the same on either item's page. For example "Error: back-to-back.
 *  Lead in 'Opening Number', then Support in 'Pirate Sketch'". */
export function describeClash({ kind, severity, first, second, gapMinutes }: Clash) {
  const label = severityLabel(severity);
  const between = `${gapMinutes} minutes between '${first.title}' and '${second.title}'`;
  if (kind === "timing") {
    return `${label}: short gap. Only ${between} (needs at least ${MIN_GAP} minutes)`;
  }
  if (kind === "quick-change") return `${label}: quick change. ${between}`;
  const partIn = ({ part, title }: Appearance) => `${roleSizeLabel(part)} in '${title}'`;
  return `${label}: back-to-back. ${partIn(first)}, then ${partIn(second)}`;
}
