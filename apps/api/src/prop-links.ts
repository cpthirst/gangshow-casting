import { type AddPropRequest, carryingCast, type Prop, type Role } from "@app/shared";
import type { PropStore } from "./prop-store.ts";
import type { RoleStore } from "./role-store.ts";

/** Whether a prop links only to its own item's roles (production-props FR18), its quantity
 *  covers its named parts, and each of its carriers is in one of its ensembles but none of
 *  its named parts, no more than the quantity leaves (FR26). itemRoles: every role in the
 *  prop's item. */
export function linksFitItem({ roleIds, quantity, carrierIds }: AddPropRequest, itemRoles: Role[]) {
  const linked = itemRoles.filter((role) => roleIds.includes(role.id));
  // roleIds has no repeats (AddPropRequest), so a shorter list means a role outside the item.
  if (linked.length !== roleIds.length) return false;
  const { named, choosable } = carryingCast(linked);
  return (
    named.length <= quantity &&
    carrierIds.length <= quantity - named.length &&
    carrierIds.every((id) => choosable.includes(id))
  );
}

/** A prop's carriers who still play one of its roles: a carrier recast, deleted from the cast
 *  or whose role was removed drops off for good, so they never come back on their own
 *  (production-props FR28). roles: every role in the production, as it is now. */
export const castCarriers = ({ roleIds, carrierIds }: Prop, roles: Role[]) =>
  carrierIds.filter((id) =>
    roles.some((role) => roleIds.includes(role.id) && role.castMemberIds.includes(id)),
  );

/** After a casting change, takes every prop's carriers who no longer play its roles off it.
 *  It runs once the change is saved, so if it fails the caller answers 500 for a change that
 *  went through: pages already hide a carrier who left the role, and the next casting change
 *  sweeps every prop again. */
export async function carriersFollowCasting(
  props: PropStore,
  roles: RoleStore,
  productionId: string,
) {
  await props.dropStrayCarriers(productionId, (await roles.list(productionId)).roles);
}
