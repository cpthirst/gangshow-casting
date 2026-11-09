import {
  type CastMember,
  type ItemMicPlot,
  type ItemNote,
  type KeptAgainstTheRule,
  MIC_CHANNELS,
  type Role,
  type RunningOrder,
} from "@app/shared";
import { sortCast } from "./cast.ts";
import type { ClashLine } from "./clashes.ts";
import { countInWords } from "./departments.ts";
import { productionPath } from "./production.ts";
import { fullName, sortRoles } from "./roles.ts";

/** Every item's channels given out. */
export const micPlotPath = () => `${productionPath()}/mic-plot`;

/** Where one of the item's channels is given out or freed. */
export const allocateMicPath = (itemId: string) =>
  `${productionPath()}/items/${encodeURIComponent(itemId)}/mic-plot`;

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

/** A channel kept after a reorder made it break the rule, as an error worded as a casting
 *  clash is, naming both items (production-mics FR10). For example "Error: back-to-back mic.
 *  Mic 1 is Alex Morgan's in 'Opening Number', then Sam Patel's in 'Finale'". */
export function keptMicError(
  { channel, castMemberId, heldBy }: KeptAgainstTheRule,
  items: { before: string; current: string },
  nameOf: (castMemberId: number) => string,
): ClashLine {
  return {
    severity: "error",
    text: `Error: back-to-back mic. Mic ${channel} is ${nameOf(heldBy)}'s in '${items.before}', then ${nameOf(castMemberId)}'s in '${items.current}'`,
  };
}

/** An item's mic count on the Overview: its channels given out, "6" over "mics", read as
 *  "6 mics" (production-mics FR12). A channel kept against the rule still counts. */
export const micsCount = (mics: number) =>
  countInWords(mics, "mic", "mics", (word) => `${mics} ${word}`);

/** An item's channels kept against the rule, summed up for its Error icon on the Overview as
 *  a casting clash is on the Items list, with the channels in place of people: "1 error:
 *  Mic 1" (production-mics FR10). None when there are none. */
export function keptMicsSummary(kept: KeptAgainstTheRule[]): ClashLine[] {
  if (kept.length === 0) return [];
  const errors = `${kept.length} ${kept.length === 1 ? "error" : "errors"}`;
  const channels = kept
    .map((mic) => mic.channel)
    .sort((a, b) => a - b)
    .map((channel) => `Mic ${channel}`);
  return [{ severity: "error", text: `${errors}: ${channels.join(", ")}` }];
}

/** One item in the Mic Plot workbook: Mic 1 to Mic 24, each with who is on it and their
 *  roles ("" while free), and its Mic plot notes ("" for none). */
export interface MicPlotItem {
  title: string;
  mics: { name: string; role: string }[];
  notes: string;
}

/** The whole show's mic plot, half by half in running order, for the workbook (production-mics
 *  FR14). Kept channels show as they do on the item's page. Only names: nothing else about the
 *  cast. */
export function micPlotListOf(show: {
  order: RunningOrder;
  cast: CastMember[];
  roles: Role[];
  plots: ItemMicPlot[];
  notes: ItemNote[];
}): MicPlotItem[][] {
  const nameOf = (id: number | null) => {
    const member = show.cast.find((m) => m.id === id);
    return member ? fullName(member) : "";
  };
  return show.order.halves.map((half) =>
    half.items.map((item) => ({
      title: item.title,
      mics: channelsOf(show.plots.find((plot) => plot.itemId === item.id)).map(
        ({ castMemberId }) => ({
          name: nameOf(castMemberId),
          role: micRolesText(item.id, castMemberId, show.roles),
        }),
      ),
      notes: show.notes.find((note) => note.itemId === item.id)?.text ?? "",
    })),
  );
}
