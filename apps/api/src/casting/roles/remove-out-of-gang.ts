import { gangOfItem, outOfGang, type Role } from "@app/shared";
import { type CastingFollowers, productionFollowsCasting } from "#/production/follow-casting.ts";
import type { CastStore } from "#/show/cast/cast-store.ts";
import type { RunningOrderStore } from "#/show/running-order/running-order-store.ts";
import type { RoleStore } from "./role-store.ts";

/** What a removal reads and changes. */
export interface GangCasting extends CastingFollowers {
  runningOrders: RunningOrderStore;
  cast: CastStore;
  roles: RoleStore;
}

/** Takes out of the roles `among` picks everyone not in their item's gang. */
export type RemoveOutOfGang = (
  productionId: string,
  among: (role: Role) => boolean,
) => Promise<void>;

/** How many times the removal re-reads roles that changed under it before giving up: plenty
 *  for a handful of volunteers editing at once. */
const PASSES = 3;

/**
 * The removal that follows a change to an item's gang (junior-cast FR5) or a member's section
 * (FR12): everyone in the roles asked about who isn't in their item's gang, as the latest
 * running order and the cast list have it, leaves those roles. Their props and mic channels
 * follow, as after any casting change (FR6). A role someone changes meanwhile is read again,
 * so their change isn't overwritten.
 */
export function outOfGangRemoval(stores: GangCasting): RemoveOutOfGang {
  return async (productionId, among) => {
    const order = await stores.runningOrders.latest(productionId);
    const members = (await stores.cast.list(productionId))?.members ?? [];
    const leavingNow = async () =>
      outOfGang((await stores.roles.list(productionId)).roles.filter(among), members, (itemId) =>
        gangOfItem(order, itemId),
      );

    let leaving = await leavingNow();
    if (leaving.length === 0) return;
    try {
      for (let pass = 0; pass < PASSES && leaving.length > 0; pass++) {
        for (const { role, castMemberIds } of leaving) {
          await stores.roles.update(productionId, role.id, role.revision, {
            name: role.name,
            size: role.size,
            castMemberIds: role.castMemberIds.filter((id) => !castMemberIds.includes(id)),
          });
        }
        leaving = await leavingNow();
      }
    } finally {
      // Whoever did leave lets go of their props and mics, even if someone else couldn't.
      await productionFollowsCasting(stores, stores.roles, productionId);
    }
    if (leaving.length > 0) {
      throw new Error("Couldn't remove everyone not in their item's gang: the roles kept changing");
    }
  };
}
