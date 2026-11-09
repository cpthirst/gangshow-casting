import { carryingCast, type Prop, type PropDetails, type Role } from "@app/shared";

/** Whether a prop links only to its own item's roles (production-props FR18), its quantity
 *  covers its named parts, and each of its carriers is in one of its ensembles but none of
 *  its named parts, no more than the quantity leaves (FR26). itemRoles: every role in the
 *  prop's item. */
export function linksFitItem({ roleIds, quantity, carrierIds }: PropDetails, itemRoles: Role[]) {
  const linked = itemRoles.filter((role) => roleIds.includes(role.id));
  // roleIds has no repeats (PropDetails), so a shorter list means a role outside the item.
  if (linked.length !== roleIds.length) return false;
  const { named, choosable } = carryingCast(linked);
  return (
    named.length <= quantity &&
    carrierIds.length <= quantity - named.length &&
    carrierIds.every((id) => choosable.includes(id))
  );
}

/** A prop's carriers who can still be chosen: in one of its ensembles, not its named parts.
 *  A carrier recast (into a named part too), deleted from the cast or whose role was removed
 *  drops off for good, so they never come back on their own (production-props FR28). roles:
 *  every role in the production, as it is now. */
export function castCarriers({ roleIds, carrierIds }: Prop, roles: Role[]) {
  const { choosable } = carryingCast(roles.filter((role) => roleIds.includes(role.id)));
  return carrierIds.filter((id) => choosable.includes(id));
}
