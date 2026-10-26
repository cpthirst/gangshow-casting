import { z } from "zod";
import { Role } from "./role.ts";
import { ProductionId, RunningOrderItem } from "./running-order.ts";

/** The longest a prop's name can be, in characters. */
export const MAX_PROP_NAME_LENGTH = 80;

/** The most roles one prop can list: far more than any item has, but a cap on what one
 *  request can make the API store and check. */
const MAX_PROP_ROLES = 200;

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
  /** The item's roles that use it, by id, never names (stage-props FR18): who plays them
   *  comes from the casting. A removed role's id may linger; pages show only roles that
   *  still exist. None for props saved before props had roles. */
  roleIds: z.array(Role.shape.id).max(MAX_PROP_ROLES).default([]),
});

/**
 * POST /api/productions/{productionId}/items/{itemId}/props: a new prop for the item, with
 * no roles unless role ids are given (each one of this item's roles).
 * 201 returns the Prop; 400 for an invalid prop or a role not in the item; 404 if the item
 * isn't in the latest saved running order. Strict, so the app-managed id and item can't be
 * sent.
 */
export const AddPropRequest = Prop.pick({ name: true, roleIds: true }).refine(
  ({ roleIds }) => new Set(roleIds).size === roleIds.length,
  { path: ["roleIds"], message: "A role is listed twice" },
);

/**
 * PUT /api/productions/{productionId}/props/{propId}: replaces a prop's name and roles, by
 * the same rules as adding one (stage-props FR19). 200 returns the Prop; 400 for an invalid
 * prop or a role not in its item; 404 if the prop is gone. DELETE on the same path removes
 * it: 204, or 404 if it's already gone.
 */
export const UpdatePropRequest = AddPropRequest;

/** GET /api/productions/{productionId}/props: every item's props, in no particular order. */
export const PropList = z.strictObject({
  productionId: ProductionId,
  props: z.array(Prop).max(5000),
});

export type Prop = z.infer<typeof Prop>;
export type PropList = z.infer<typeof PropList>;
export type AddPropRequest = z.infer<typeof AddPropRequest>;
export type UpdatePropRequest = z.infer<typeof UpdatePropRequest>;
