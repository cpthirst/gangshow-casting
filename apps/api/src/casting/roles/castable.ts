import { castableIn, type ItemGang, itemGangLabels, type RunningOrder } from "@app/shared";
import { messageResponse } from "#/http/json.ts";
import type { CastStore } from "#/show/cast/cast-store.ts";

/** The gang an item in the order is for; any gang for an item that isn't in it. */
export const gangOfItem = (order: RunningOrder | undefined, itemId: string): ItemGang =>
  order?.halves.flatMap((half) => half.items).find((item) => item.id === itemId)?.gang ?? "both";

/**
 * Why these people can't be cast in an item for this gang, as a 400, or undefined when they
 * can: each must be on the production's cast list (no list, nobody) and in the item's gang
 * (junior-cast FR11).
 */
export async function castingRefusal(
  cast: CastStore,
  productionId: string,
  ids: number[],
  gang: ItemGang,
) {
  if (ids.length === 0) return undefined;
  const members = (await cast.list(productionId))?.members ?? [];
  for (const id of ids) {
    const member = members.find((m) => m.id === id);
    if (!member) return { statusCode: 400 };
    if (!castableIn(gang, member.section)) {
      const name = `${member.firstName} ${member.lastName}`;
      return messageResponse(400, `${name} isn't in the ${itemGangLabels[gang]} gang`);
    }
  }
  return undefined;
}
