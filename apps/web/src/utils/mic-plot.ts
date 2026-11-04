import { type CastMember, type ItemMicPlot, MIC_CHANNELS, type Role } from "@app/shared";
import { sortCast } from "./cast.ts";
import { sortRoles } from "./roles.ts";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** Every item's channels given out. */
export const MIC_PLOT_PATH = `/api/productions/${PRODUCTION_ID}/mic-plot`;

/** Where one of the item's channels is given out or freed. */
export const allocateMicPath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/mic-plot`;

/** Every item's Mic plot notes, apart from its other notes (production-mics FR8). */
export const MIC_PLOT_NOTES_PATH = `/api/productions/${PRODUCTION_ID}/mic-plot-notes`;

/** Where an item's Mic plot notes are saved. */
export const saveMicPlotNotesPath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/mic-plot-notes`;

export interface ChannelRow {
  channel: number;
  /** Who is on it; null while it's free. */
  castMemberId: number | null;
}

/** Mic 1 to Mic 24, always all of them, each with who is on it (production-mics FR2). */
export const channelsOf = (plot: ItemMicPlot | undefined): ChannelRow[] =>
  Array.from({ length: MIC_CHANNELS }, (_, i) => ({
    channel: i + 1,
    castMemberId: plot?.mics.find((mic) => mic.channel === i + 1)?.castMemberId ?? null,
  }));

/** Everyone cast in one of the item's roles, by surname: the only people who can have one
 *  of its mics (production-mics FR3). */
export function castInItem(itemId: string, roles: Role[], cast: CastMember[]) {
  const ids = new Set(
    roles.filter((role) => role.itemId === itemId).flatMap((role) => role.castMemberIds),
  );
  return sortCast(cast.filter((member) => ids.has(member.id)));
}

/** Who can be chosen for the channel: the item's cast, but for anyone on another of its
 *  channels (production-mics FR4), and only whoever had it in the item before, if anyone did
 *  (FR5; see channelsHeldBefore). */
export function choicesFor(
  channel: number,
  itemCast: CastMember[],
  plot: ItemMicPlot | undefined,
  heldBy?: number,
) {
  const elsewhere = new Set(
    plot?.mics.filter((mic) => mic.channel !== channel).map((mic) => mic.castMemberId),
  );
  return itemCast.filter(
    (member) => !elsewhere.has(member.id) && (heldBy === undefined || member.id === heldBy),
  );
}

/** A mic's role, as plain text: every role its cast member plays in the item, ensembles too,
 *  biggest first ("Narrator, Alien 1"). Worked out from the casting, never saved, so it always
 *  matches it (production-mics FR3). Nothing while the mic is free. */
export function micRolesText(itemId: string, castMemberId: number | null, roles: Role[]) {
  if (castMemberId === null) return "";
  const theirs = roles.filter(
    (role) => role.itemId === itemId && role.castMemberIds.includes(castMemberId),
  );
  return sortRoles(theirs)
    .map((role) => role.name)
    .join(", ");
}
