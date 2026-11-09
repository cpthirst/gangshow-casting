import {
  AllocateMicRequest,
  channelsHeldBefore,
  channelsKeptAgainstTheRule,
  RunningOrderItem,
} from "@app/shared";
import type { RoleStore } from "#/casting/roles/role-store.ts";
import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import {
  latestOrderWith,
  type RunningOrderStore,
} from "#/show/running-order/running-order-store.ts";
import type { MicPlotStore } from "./mic-plot-store.ts";

// PUT /api/productions/{productionId}/items/{itemId}/mic-plot: give one of the item's channels
// to a cast member cast in it, or free it (production-mics FR3, FR4), unless someone else had
// that channel in the item before (FR5, FR6). A channel kept after a reorder made it break
// that rule can only be cleared (FR10). Only Tech, a Director or an admin get here
// (routeNeeds in @app/shared). The item-before check and the save aren't one step, so two
// saves at once could slip past it; such an allocation is then kept, as after a reorder.
export function createAllocateMic(
  micPlots: MicPlotStore,
  runningOrders: RunningOrderStore,
  roles: RoleStore,
): Handler {
  return inProduction(async (productionId, event) => {
    const itemId = RunningOrderItem.shape.id.safeParse(event.pathParameters?.itemId);
    if (!itemId.success) return { statusCode: 404 };
    // The body is checked first, so a bad request is a 400 whatever the item.
    const request = AllocateMicRequest.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };

    // Mic plots belong to items in the latest saved running order, as roles do.
    const order = await latestOrderWith(runningOrders, productionId, itemId.data);
    if (!order) return { statusCode: 404 };

    const { channel, castMemberId } = request.data;
    if (castMemberId !== null) {
      const itemRoles = (await roles.list(productionId)).roles.filter(
        (role) => role.itemId === itemId.data,
      );
      const castInItem = itemRoles.some((role) => role.castMemberIds.includes(castMemberId));
      if (!castInItem) return { statusCode: 400 };
      const plots = (await micPlots.list(productionId)).items;
      const kept = channelsKeptAgainstTheRule(order, plots, itemId.data);
      if (kept.some((mic) => mic.channel === channel)) return { statusCode: 400 };
      const heldBy = channelsHeldBefore(order, plots, itemId.data).get(channel);
      if (heldBy !== undefined && heldBy !== castMemberId) return { statusCode: 400 };
    }

    const plot = await micPlots.allocate(productionId, itemId.data, channel, castMemberId);
    if ("onAnotherChannel" in plot) return jsonResponse(409, plot.onAnotherChannel);
    return jsonResponse(200, plot);
  });
}
