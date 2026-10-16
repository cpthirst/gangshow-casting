import { type Role, RoleSize, type RunningOrder } from "@app/shared";
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
  const gap = second.starts - first.ends;
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
      const found = second && problem(first, second);
      if (!second || !found) continue;
      clashes.push({
        castMemberId,
        ...found,
        first: appearance(first),
        second: appearance(second),
        gapMinutes: second.starts - first.ends,
      });
    }
  }
  return clashes;
}

const involvesEnsemble = (first: Slot, second: Slot) =>
  first.part === "ensemble" || second.part === "ensemble";

const appearance = ({ itemId, title, part }: Slot): Appearance => ({ itemId, title, part });

const rank = (severity: Severity) => SEVERITIES.indexOf(severity);

/** A person's clashes that involve an item, worst first (FR7). */
export const clashesOf = (clashes: Clash[], castMemberId: number, itemId: string) =>
  clashes
    .filter(
      (clash) =>
        clash.castMemberId === castMemberId &&
        (clash.first.itemId === itemId || clash.second.itemId === itemId),
    )
    // A stable sort: clashes of the same severity stay in running order.
    .sort((a, b) => rank(a.severity) - rank(b.severity));

/** What a clash means, seen from one of its items, as plain text (never HTML). For example
 *  "Error: back-to-back. Also Lead in 'Opening Number', straight before this item" (FR7). */
export function describeClash(clash: Clash, itemId: string) {
  const label = severityLabel(clash.severity);
  const between = `${clash.gapMinutes} minutes between '${clash.first.title}' and '${clash.second.title}'`;
  if (clash.kind === "timing") return `${label}: only ${between} (needs ${MIN_GAP})`;
  if (clash.kind === "quick-change") return `${label}: quick change. ${between}`;
  const isFirst = clash.first.itemId === itemId;
  const other = isFirst ? clash.second : clash.first;
  const when = isFirst ? "straight after" : "straight before";
  return `${label}: back-to-back. Also ${roleSizeLabel(other.part)} in '${other.title}', ${when} this item`;
}
