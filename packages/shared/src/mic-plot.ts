import { z } from "zod";
import { CastMember } from "./cast.ts";
import { ProductionId, RunningOrderItem } from "./running-order.ts";

/** The show's radio mic channels, Mic 1 to Mic 24: always this many (production-mics FR2). */
export const MIC_CHANNELS = 24;

export const MicChannel = z.number().int().min(1).max(MIC_CHANNELS);

/** One channel given to one cast member in the item. It holds their id, never their name. */
export const MicAllocation = z.strictObject({
  channel: MicChannel,
  castMemberId: CastMember.shape.id,
});

const noRepeats = (values: number[]) => new Set(values).size === values.length;

/**
 * One item's mic plot: only the channels given out, each once, and each cast member on one
 * channel at most (production-mics FR4).
 */
export const ItemMicPlot = z
  .strictObject({
    itemId: RunningOrderItem.shape.id,
    mics: z.array(MicAllocation).max(MIC_CHANNELS),
  })
  .refine(({ mics }) => noRepeats(mics.map((mic) => mic.channel)), {
    path: ["mics"],
    message: "A channel is given twice",
  })
  .refine(({ mics }) => noRepeats(mics.map((mic) => mic.castMemberId)), {
    path: ["mics"],
    message: "Someone is on two channels",
  });

/** GET /api/productions/{productionId}/mic-plot: every item's mic plot; an item with no
 *  channels given out may be left out. */
export const MicPlotList = z.strictObject({
  productionId: ProductionId,
  items: z.array(ItemMicPlot).max(1000),
});

/**
 * An item's mic plot as a store reads it back: any field it doesn't keep is dropped rather
 * than refused, such as a role on a mic saved by an unreleased build (production-mics E1.S2),
 * then held to every rule ItemMicPlot keeps. The next save writes it without them. Once no
 * stored mic plot has such a field, stores can read with ItemMicPlot again.
 */
export const StoredItemMicPlot = z
  .object({
    itemId: RunningOrderItem.shape.id,
    mics: z.array(z.object(MicAllocation.shape)).max(MIC_CHANNELS),
  })
  .pipe(ItemMicPlot);

/** Every item's mic plot as a store reads it back (see StoredItemMicPlot). */
export const StoredMicPlotList = MicPlotList.extend({
  items: z.array(StoredItemMicPlot).max(1000),
});

/**
 * PUT /api/productions/{productionId}/items/{itemId}/mic-plot: give the channel to a cast
 * member cast in the item, or free it with null. 200 returns the item's ItemMicPlot; 400 for
 * a channel outside 1 to 24 or someone not cast in the item; 409, with the item's plot as it
 * is now, if they're already on another of its channels; 404 if the item isn't in the latest
 * saved running order.
 */
export const AllocateMicRequest = z.strictObject({
  channel: MicChannel,
  castMemberId: CastMember.shape.id.nullable(),
});

export type MicAllocation = z.infer<typeof MicAllocation>;
export type ItemMicPlot = z.infer<typeof ItemMicPlot>;
export type MicPlotList = z.infer<typeof MicPlotList>;
export type AllocateMicRequest = z.infer<typeof AllocateMicRequest>;
