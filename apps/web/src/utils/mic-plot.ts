import { type CastMember, type ItemMicPlot, MIC_CHANNELS, type Role } from "@app/shared";
import { sortCast } from "./cast.ts";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** Every item's channels given out. */
export const MIC_PLOT_PATH = `/api/productions/${PRODUCTION_ID}/mic-plot`;

/** Where one of the item's channels is given out or freed. */
export const allocateMicPath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/mic-plot`;

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
 *  channels (production-mics FR4). */
export function choicesFor(channel: number, itemCast: CastMember[], plot: ItemMicPlot | undefined) {
  const elsewhere = new Set(
    plot?.mics.filter((mic) => mic.channel !== channel).map((mic) => mic.castMemberId),
  );
  return itemCast.filter((member) => !elsewhere.has(member.id));
}
