import { z } from "zod";
import { ProductionId, RunningOrderItem } from "./running-order.ts";

/** The longest a prop's name can be, in characters. */
export const MAX_PROP_NAME_LENGTH = 80;

/**
 * Something one item needs on stage (stage-props FR13). The production's own, apart from
 * the casting: strict, so it can never carry cast data.
 */
export const Prop = z.strictObject({
  /** Assigned by the app; never edited or reused. */
  id: z.number().int().positive(),
  /** The running-order item it belongs to. */
  itemId: RunningOrderItem.shape.id,
  /** What it is, e.g. "Treasure chest". */
  name: z.string().trim().min(1).max(MAX_PROP_NAME_LENGTH),
});

/**
 * POST /api/productions/{productionId}/items/{itemId}/props: a new prop for the item.
 * 201 returns the Prop; 400 for an invalid prop; 404 if the item isn't in the latest saved
 * running order. Strict, so the app-managed id and item can't be sent.
 */
export const AddPropRequest = Prop.pick({ name: true });

/** GET /api/productions/{productionId}/props: every item's props, in no particular order. */
export const PropList = z.strictObject({
  productionId: ProductionId,
  props: z.array(Prop).max(5000),
});

export type Prop = z.infer<typeof Prop>;
export type PropList = z.infer<typeof PropList>;
export type AddPropRequest = z.infer<typeof AddPropRequest>;
