import { z } from "zod";
import { CastMember } from "./cast.ts";
import { Role } from "./role.ts";
import { ProductionId, RunningOrderItem } from "./running-order.ts";

/** The longest a prop's name can be, in characters. */
export const MAX_PROP_NAME_LENGTH = 80;

/** The most of one prop an item can need (production-props FR24). */
export const MAX_PROP_QUANTITY = 99;

/** The most roles one prop can list: far more than any item has, but a cap on what one
 *  request can make the API store and check. */
const MAX_PROP_ROLES = 200;

/**
 * Something one item needs on stage (production-props FR13). The production's own, apart from
 * the casting: strict, so it can never carry cast data.
 */
export const Prop = z.strictObject({
  /** Assigned by the app; never edited or reused. */
  id: z.number().int().positive(),
  /** The running-order item it belongs to. */
  itemId: RunningOrderItem.shape.id,
  /** What it is, e.g. "Treasure chest". */
  name: z.string().trim().min(1).max(MAX_PROP_NAME_LENGTH),
  /** How many the item needs, e.g. 10 umbrellas (production-props FR24). 1 for props saved
   *  before props had quantities. */
  quantity: z.number().int().min(1).max(MAX_PROP_QUANTITY).default(1),
  /** The item's roles that use it, by id, never names (production-props FR18): who plays them
   *  comes from the casting. A removed role's id may linger; pages show only roles that
   *  still exist. None for props saved before props had roles. */
  roleIds: z.array(Role.shape.id).max(MAX_PROP_ROLES).default([]),
  /** Who carries it, by cast member id, never names (ADR 0010), when its roles have more
   *  people than its quantity (production-props FR26). Each plays one of its roles. None when
   *  everyone in its roles carries it (FR27), and for props saved before props had carriers. */
  carrierIds: z.array(CastMember.shape.id).max(MAX_PROP_QUANTITY).default([]),
});

const noRepeats = (ids: number[]) => new Set(ids).size === ids.length;

/** Who carries a prop, from its roles as they're cast now (production-props FR26): everyone
 *  in a named part (any size but ensemble, so one person) always does, and carriers are
 *  chosen only from the rest of its ensembles' cast. Each id once. */
export function carryingCast(roles: Pick<Role, "size" | "castMemberIds">[]) {
  const castIn = (some: typeof roles) => [...new Set(some.flatMap((role) => role.castMemberIds))];
  const named = castIn(roles.filter((role) => role.size !== "ensemble"));
  const ensembles = castIn(roles.filter((role) => role.size === "ensemble"));
  return { named, choosable: ensembles.filter((id) => !named.includes(id)) };
}

/**
 * POST /api/productions/{productionId}/items/{itemId}/props: a new prop for the item, with
 * a quantity of 1 and no roles or carriers unless given (each role one of this item's, each
 * carrier in one of those roles' cast, and no more carriers than the quantity).
 * 201 returns the Prop; 400 for an invalid prop, a role not in the item or a carrier not in
 * its roles; 404 if the item isn't in the latest saved running order. Strict, so the
 * app-managed id and item can't be sent.
 */
export const AddPropRequest = Prop.pick({
  name: true,
  quantity: true,
  roleIds: true,
  carrierIds: true,
})
  .refine(({ roleIds }) => noRepeats(roleIds), {
    path: ["roleIds"],
    message: "A role is listed twice",
  })
  .refine(({ carrierIds }) => noRepeats(carrierIds), {
    path: ["carrierIds"],
    message: "Someone is listed twice",
  })
  .refine(({ carrierIds, quantity }) => carrierIds.length <= quantity, {
    path: ["carrierIds"],
    message: "More carriers than the quantity",
  });

/**
 * PUT /api/productions/{productionId}/props/{propId}: replaces a prop's name, quantity, roles
 * and carriers, by the same rules as adding one (production-props FR19, FR24, FR26). 200
 * returns the Prop; 400 for an invalid prop, a role not in its item or a carrier not in its
 * roles; 404 if the prop is gone. A quantity, roles or carriers left out are replaced too, by
 * 1 and none. DELETE on the same path removes it: 204,
 * or 404 if it's already gone.
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
