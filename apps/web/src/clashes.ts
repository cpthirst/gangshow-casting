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

export const severityLabel = (severity: Severity) => severityLabels[severity];

// RoleSize is declared biggest first, so a lower index is a bigger part.
const biggest = (a: RoleSize, b: RoleSize) =>
  RoleSize.options.indexOf(a) <= RoleSize.options.indexOf(b) ? a : b;

/** Every clash in the show: each person's appearances in running order, compared one after
 *  the other (casting-rules FR1, FR2). */
export function findClashes(order: RunningOrder, roles: Role[]): Clash[] {
  const shown = order.halves.flatMap((half, halfIndex) =>
    half.items.map((item) => ({ item, halfIndex })),
  );
  const positionOf = new Map(shown.map(({ item }, position) => [item.id, position]));

  // Person → position in the show → their biggest part there.
  const parts = new Map<number, Map<number, RoleSize>>();
  for (const role of roles) {
    const position = positionOf.get(role.itemId);
    if (position === undefined) continue;
    for (const id of role.castMemberIds) {
      const theirs = parts.get(id) ?? new Map<number, RoleSize>();
      const part = theirs.get(position);
      theirs.set(position, part ? biggest(part, role.size) : role.size);
      parts.set(id, theirs);
    }
  }

  const appearanceAt = (position: number, part: RoleSize): Appearance | undefined => {
    const item = shown[position]?.item;
    return item && { itemId: item.id, title: item.title, part };
  };

  const clashes: Clash[] = [];
  for (const [castMemberId, theirs] of parts) {
    const inOrder = [...theirs].sort(([a], [b]) => a - b);
    for (const [[before, beforePart], [after, afterPart]] of pairs(inOrder)) {
      const sameHalf = shown[before]?.halfIndex === shown[after]?.halfIndex;
      if (after !== before + 1 || !sameHalf) continue;
      const first = appearanceAt(before, beforePart);
      const second = appearanceAt(after, afterPart);
      if (!first || !second) continue;
      clashes.push({ castMemberId, kind: "back-to-back", severity: "error", first, second });
    }
  }
  return clashes;
}

/** Each element with the one after it. */
function pairs<T>(list: T[]) {
  const result: [T, T][] = [];
  list.forEach((item, i) => {
    const next = list[i + 1];
    if (next !== undefined) result.push([item, next]);
  });
  return result;
}

/** A person's clashes that involve an item. */
export const clashesOf = (clashes: Clash[], castMemberId: number, itemId: string) =>
  clashes.filter(
    (clash) =>
      clash.castMemberId === castMemberId &&
      (clash.first.itemId === itemId || clash.second.itemId === itemId),
  );

/** What a clash means, seen from one of its items: "Error: back-to-back. Also Lead in
 *  'Opening Number', straight before this item" (casting-rules FR7). */
export function describeClash(clash: Clash, itemId: string) {
  const isFirst = clash.first.itemId === itemId;
  const other = isFirst ? clash.second : clash.first;
  const when = isFirst ? "straight after" : "straight before";
  return `${severityLabel(clash.severity)}: back-to-back. Also ${roleSizeLabel(other.part)} in '${other.title}', ${when} this item`;
}
