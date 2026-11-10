import { z } from "zod";

/** Identifies a production (e.g. "2027"); also used as a folder name, so kept to a safe alphabet. */
export const ProductionId = z.string().regex(/^[a-z0-9-]{1,40}$/i);

export const Stage = z.enum(["apron", "full"]);

/** Which gang an item is for, Junior first as the Cast page's gang filter lists them, in
 *  the order the item editor offers them (junior-cast FR2). */
export const ItemGang = z.enum(["junior", "senior", "both"]);
export type ItemGang = z.infer<typeof ItemGang>;

/** Each item gang's label: the one list the item editor and the cast's gang labels read. */
export const itemGangLabels = {
  junior: "Junior",
  senior: "Senior",
  both: "Both",
} as const satisfies Record<ItemGang, string>;

export const RunningOrderItem = z.object({
  id: z.string().min(1).max(40),
  title: z.string().trim().min(1).max(120),
  cast: z.string().max(500),
  /** In performance order, e.g. apron → full → apron. */
  stage: z.array(Stage).max(10),
  leads: z.string().max(500),
  comments: z.string().max(500),
  /** Timing guideline; null while untimed. */
  minutes: z.number().int().min(0).max(240).nullable(),
  /** False for items left out of the printed show programme. */
  printed: z.boolean(),
  /** Who can be cast in it. Senior unless marked otherwise, so items saved before items had a
   *  gang read as Senior (junior-cast FR2). */
  gang: ItemGang.default("senior"),
});

const Half = <Id extends string>(id: Id) =>
  z.object({ id: z.literal(id), name: z.string().max(60), items: z.array(RunningOrderItem) });

/** One saved version of a production's running order. Numbers and times are derived, never stored. */
export const RunningOrder = z.object({
  productionId: ProductionId,
  title: z.string().max(120),
  version: z.number().int().positive(),
  savedAt: z.iso.datetime(),
  /** Curtain up, 24-hour "HH:MM". */
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  intervalMinutes: z.number().int().min(0),
  halves: z.tuple([Half("first-half"), Half("second-half")]),
});

/** Every item in the order, first half then second, in performance order. */
export const itemsOf = (order: RunningOrder) => order.halves.flatMap((half) => half.items);

/** The gang an item in the order is for; any gang for an item that isn't in it. */
export const gangOfItem = (order: RunningOrder | undefined, itemId: string): ItemGang =>
  (order && itemsOf(order).find((item) => item.id === itemId)?.gang) ?? "both";

/** The items in both orders that are for another gang after: the ones whose roles lose anyone
 *  not in their new gang (junior-cast FR5). An added or cut item has no casting to keep. */
export function itemsChangingGang(before: RunningOrder, after: RunningOrder) {
  const was = new Map(itemsOf(before).map((item) => [item.id, item.gang]));
  return itemsOf(after)
    .filter((item) => was.has(item.id) && was.get(item.id) !== item.gang)
    .map((item) => item.id);
}

export type Stage = z.infer<typeof Stage>;
export type RunningOrderItem = z.infer<typeof RunningOrderItem>;
export type NewRunningOrderItem = z.infer<typeof NewRunningOrderItem>;
/** An item as a change carries it: saved already (with an id) or new. */
export type ChangeItem = RunningOrderItem | NewRunningOrderItem;
export type RunningOrder = z.infer<typeof RunningOrder>;

/** An item added in a change. It has no id yet: the server gives it one when it saves.
 *  Strict, so an item with a bad id can't pass as a new one. */
export const NewRunningOrderItem = z.strictObject(RunningOrderItem.omit({ id: true }).shape);

const HalfItems = <Id extends string>(id: Id) =>
  z.object({
    id: z.literal(id),
    items: z.array(z.union([RunningOrderItem, NewRunningOrderItem])).max(100),
  });

/** Every item the show will have, in its new place and with its (possibly edited) details,
 *  and the items added (no id yet). The server checks every item of the latest version is
 *  either here once or removed, and nothing else was invented. */
export const UpdateChange = z.object({
  type: z.literal("update"),
  halves: z.tuple([HalfItems("first-half"), HalfItems("second-half")]),
});

/** One change, applied to the latest version. */
export const RunningOrderChange = z.discriminatedUnion("type", [UpdateChange]);

/**
 * POST /api/productions/{productionId}/running-order/versions.
 * 201 → the new RunningOrder; 409 → the latest RunningOrder (baseVersion was stale);
 * 400 → the request or change was invalid.
 */
export const SaveRunningOrderRequest = z.object({
  baseVersion: z.number().int().positive(),
  change: RunningOrderChange,
});

export type UpdateChange = z.infer<typeof UpdateChange>;
export type RunningOrderChange = z.infer<typeof RunningOrderChange>;
export type SaveRunningOrderRequest = z.infer<typeof SaveRunningOrderRequest>;
