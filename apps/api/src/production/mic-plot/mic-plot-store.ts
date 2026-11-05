import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type ItemMicPlot,
  type MicPlotList,
  ProductionId,
  type Role,
  StoredMicPlotList,
} from "@app/shared";
import { parseJson } from "#/http/json.ts";
import { ifExists } from "#/storage/files.ts";
import { oneAtATime, writePrivateFile } from "#/storage/private-file.ts";

/** Refused: the cast member is already on another of the item's channels, as it is now. */
export type OnAnotherChannel = { onAnotherChannel: ItemMicPlot };

/** Where each production's mic plot lives: who is on which channel in each item
 *  (production-mics FR2, FR11). */
export interface MicPlotStore {
  /** Every item's channels given out; an item with none is left out. */
  list(productionId: string): Promise<MicPlotList>;
  /** Gives the item's channel to the cast member, or frees it (null), answering with the
   *  item's mic plot. Refused if they're on another of its channels (FR4). Whether they're cast
   *  in the item is the caller's to check. */
  allocate(
    productionId: string,
    itemId: string,
    channel: number,
    castMemberId: number | null,
  ): Promise<ItemMicPlot | OnAnotherChannel>;
  /** Deletes the mic plot of every item not in `itemIds`, for good (FR11). */
  keepOnlyItems(productionId: string, itemIds: string[]): Promise<void>;
  /** Frees every channel held by someone no longer cast in its item (FR9). roles: every role
   *  in the production, as it is now. */
  freeUncastChannels(productionId: string, roles: Role[]): Promise<void>;
}

const empty = (productionId: string): MicPlotList => ({ productionId, items: [] });

/** The item's plot with the channel given or freed, in channel order, or why not. */
export function withAllocation(
  plot: ItemMicPlot,
  channel: number,
  castMemberId: number | null,
): ItemMicPlot | OnAnotherChannel {
  const elsewhere = plot.mics.some(
    (mic) => mic.castMemberId === castMemberId && mic.channel !== channel,
  );
  if (elsewhere) return { onAnotherChannel: plot };
  const others = plot.mics.filter((mic) => mic.channel !== channel);
  const mics = castMemberId === null ? others : [...others, { channel, castMemberId }];
  return { ...plot, mics: mics.sort((a, b) => a.channel - b.channel) };
}

/** The item's plot with only the channels of those still cast in one of its roles. */
export function castMics(plot: ItemMicPlot, roles: Role[]): ItemMicPlot {
  const cast = new Set(
    roles.filter((role) => role.itemId === plot.itemId).flatMap((role) => role.castMemberIds),
  );
  return { ...plot, mics: plot.mics.filter((mic) => cast.has(mic.castMemberId)) };
}

const plotOf = (list: MicPlotList, itemId: string): ItemMicPlot =>
  list.items.find((item) => item.itemId === itemId) ?? { itemId, mics: [] };

/** The list with one item's plot allocated, dropping the item once it has no channels. */
function withItemAllocation(
  list: MicPlotList,
  itemId: string,
  channel: number,
  castMemberId: number | null,
) {
  const plot = withAllocation(plotOf(list, itemId), channel, castMemberId);
  if ("onAnotherChannel" in plot) return { plot, list };
  const others = list.items.filter((item) => item.itemId !== itemId);
  return { plot, list: { ...list, items: plot.mics.length > 0 ? [...others, plot] : others } };
}

const onlyItems = (list: MicPlotList, itemIds: string[]): MicPlotList => ({
  ...list,
  items: list.items.filter((item) => itemIds.includes(item.itemId)),
});

/** The list with every uncast channel freed, dropping items left with none. */
const withCastMics = (list: MicPlotList, roles: Role[]): MicPlotList => ({
  ...list,
  items: list.items.map((plot) => castMics(plot, roles)).filter((plot) => plot.mics.length > 0),
});

/** Mic plots held in memory, starting with those given: for tests. */
export function inMemoryMicPlotStore(saved: MicPlotList[] = []): MicPlotStore {
  const lists = new Map<string, MicPlotList>(saved.map((list) => [list.productionId, list]));
  const listOf = (productionId: string) => lists.get(productionId) ?? empty(productionId);
  return {
    list: async (productionId) => listOf(productionId),
    async allocate(productionId, itemId, channel, castMemberId) {
      const allocated = withItemAllocation(listOf(productionId), itemId, channel, castMemberId);
      lists.set(productionId, allocated.list);
      return allocated.plot;
    },
    async keepOnlyItems(productionId, itemIds) {
      lists.set(productionId, onlyItems(listOf(productionId), itemIds));
    },
    async freeUncastChannels(productionId, roles) {
      lists.set(productionId, withCastMics(listOf(productionId), roles));
    },
  };
}

/** Local file: `<dataDir>/<productionId>/mic-plot.json` (git-ignored), created with the first
 *  mic given out. It links children to channels, so kept owner-only. */
export function fileMicPlotStore(dataDir: string): MicPlotStore {
  // The id becomes a folder name: never trust callers to have checked it.
  const fileFor = (productionId: string) => {
    if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
    return join(dataDir, productionId, "mic-plot.json");
  };

  async function read(productionId: string) {
    const text = await ifExists(() => readFile(fileFor(productionId), "utf8"));
    if (text === undefined) return empty(productionId);
    const parsed = StoredMicPlotList.safeParse(parseJson(text));
    if (!parsed.success || parsed.data.productionId !== productionId) {
      throw new Error(`Mic plot file for production ${productionId} is invalid`);
    }
    return parsed.data;
  }

  const write = (list: MicPlotList) =>
    writePrivateFile(fileFor(list.productionId), JSON.stringify(list, null, 2));
  const inTurn = oneAtATime();

  return {
    list: read,
    allocate: (productionId, itemId, channel, castMemberId) =>
      // Checked and saved in one turn, so two at once can't put someone on two channels.
      inTurn(async () => {
        const allocated = withItemAllocation(
          await read(productionId),
          itemId,
          channel,
          castMemberId,
        );
        if (!("onAnotherChannel" in allocated.plot)) await write(allocated.list);
        return allocated.plot;
      }),
    keepOnlyItems: (productionId, itemIds) =>
      inTurn(async () => {
        const list = await read(productionId);
        const kept = onlyItems(list, itemIds);
        // Nothing to write if every item stays (or there's no file yet).
        if (kept.items.length === list.items.length) return;
        await write(kept);
      }),
    freeUncastChannels: (productionId, roles) =>
      inTurn(async () => {
        const list = await read(productionId);
        const kept = withCastMics(list, roles);
        // Nothing to write if no one lost a channel (or there's no file yet).
        if (JSON.stringify(kept) === JSON.stringify(list)) return;
        await write(kept);
      }),
  };
}
