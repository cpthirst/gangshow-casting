import { z } from "zod";

/** Identifies a production (e.g. "2027"); also used as a folder name, so kept to a safe alphabet. */
export const ProductionId = z.string().regex(/^[a-z0-9-]{1,40}$/i);

export const Stage = z.enum(["apron", "full"]);

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

export type Stage = z.infer<typeof Stage>;
export type RunningOrderItem = z.infer<typeof RunningOrderItem>;
export type RunningOrder = z.infer<typeof RunningOrder>;

const HalfOrder = <Id extends string>(id: Id) =>
  z.object({ id: z.literal(id), itemIds: z.array(RunningOrderItem.shape.id).max(100) });

/** Every item, in its new place. The server checks it's the same set of items. */
export const ReorderChange = z.object({
  type: z.literal("reorder"),
  halves: z.tuple([HalfOrder("first-half"), HalfOrder("second-half")]),
});

/** One change, applied to the latest version. Later stories add edit, add and remove. */
export const RunningOrderChange = z.discriminatedUnion("type", [ReorderChange]);

/**
 * POST /api/productions/{productionId}/running-order/versions.
 * 201 → the new RunningOrder; 409 → the latest RunningOrder (baseVersion was stale);
 * 400 → the request or change was invalid.
 */
export const SaveRunningOrderRequest = z.object({
  baseVersion: z.number().int().positive(),
  change: RunningOrderChange,
});

export type ReorderChange = z.infer<typeof ReorderChange>;
export type RunningOrderChange = z.infer<typeof RunningOrderChange>;
export type SaveRunningOrderRequest = z.infer<typeof SaveRunningOrderRequest>;
