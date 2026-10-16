import { type Role, RoleSize, type RunningOrder } from "@app/shared";
import { roleSizeLabel } from "./roles.ts";

/** How serious a clash is, most serious first (casting-rules FR11). */
export type Severity = "error" | "warning" | "info";

/** One of a person's appearances: an item, and their biggest part in it. */
export interface Appearance {
  itemId: string;
  title: string;
  part: RoleSize;
}

/** A problem for one person between two of their appearances, one after the other. */
export interface Clash {
  castMemberId: number;
  kind: "back-to-back";
  severity: Severity;
  first: Appearance;
  second: Appearance;
}

const severityLabels: Record<Severity, string> = {
  error: "Error",
  warning: "Warning",
  info: "Info",
};

const severityLabel = (severity: Severity) => severityLabels[severity];

// RoleSize is declared biggest first, so a lower index is a bigger part.
const biggest = (a: RoleSize, b: RoleSize) =>
  RoleSize.options.indexOf(a) <= RoleSize.options.indexOf(b) ? a : b;

/** Where one of a person's appearances falls in the show. */
interface Slot extends Appearance {
  position: number;
  halfIndex: number;
}

/** Every clash in the show: each person's appearances in running order, compared one after
 *  the other (casting-rules FR1, FR2). */
export function findClashes(order: RunningOrder, roles: Role[]): Clash[] {
  const shown = new Map(
    order.halves
      .flatMap((half, halfIndex) => half.items.map((item) => ({ item, halfIndex })))
      .map((place, position) => [place.item.id, { ...place, position }]),
  );

  // Person → item → where it is and their biggest part in it.
  const slots = new Map<number, Map<string, Slot>>();
  for (const role of roles) {
    const place = shown.get(role.itemId);
    if (!place) continue;
    for (const id of role.castMemberIds) {
      const theirs = slots.get(id) ?? new Map<string, Slot>();
      const part = theirs.get(role.itemId)?.part;
      theirs.set(role.itemId, {
        itemId: place.item.id,
        title: place.item.title,
        part: part ? biggest(part, role.size) : role.size,
        position: place.position,
        halfIndex: place.halfIndex,
      });
      slots.set(id, theirs);
    }
  }

  const clashes: Clash[] = [];
  for (const [castMemberId, theirs] of slots) {
    const inOrder = [...theirs.values()].sort((a, b) => a.position - b.position);
    for (const [i, first] of inOrder.entries()) {
      const second = inOrder[i + 1];
      const isBackToBack =
        second?.position === first.position + 1 && second.halfIndex === first.halfIndex;
      if (!second || !isBackToBack) continue;
      clashes.push({
        castMemberId,
        kind: "back-to-back",
        severity: "error",
        first: appearance(first),
        second: appearance(second),
      });
    }
  }
  return clashes;
}

const appearance = ({ itemId, title, part }: Slot): Appearance => ({ itemId, title, part });

/** A person's clashes that involve an item. */
export const clashesOf = (clashes: Clash[], castMemberId: number, itemId: string) =>
  clashes.filter(
    (clash) =>
      clash.castMemberId === castMemberId &&
      (clash.first.itemId === itemId || clash.second.itemId === itemId),
  );

/** What a clash means, seen from one of its items (plain text, never HTML): "Error: back-to-back. Also Lead in
 *  'Opening Number', straight before this item" (casting-rules FR7). */
export function describeClash(clash: Clash, itemId: string) {
  const isFirst = clash.first.itemId === itemId;
  const other = isFirst ? clash.second : clash.first;
  const when = isFirst ? "straight after" : "straight before";
  return `${severityLabel(clash.severity)}: back-to-back. Also ${roleSizeLabel(other.part)} in '${other.title}', ${when} this item`;
}
