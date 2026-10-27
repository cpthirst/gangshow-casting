import type { AddPropRequest, Role } from "@app/shared";

/** Whether a prop links only to its own item's roles (production-props FR18), and each of its
 *  carriers plays one of those roles (FR26). itemRoles: every role in the prop's item. */
export function linksFitItem({ roleIds, carrierIds }: AddPropRequest, itemRoles: Role[]) {
  const linked = itemRoles.filter((role) => roleIds.includes(role.id));
  // roleIds has no repeats (AddPropRequest), so a shorter list means a role outside the item.
  if (linked.length !== roleIds.length) return false;
  return carrierIds.every((id) => linked.some((role) => role.castMemberIds.includes(id)));
}
