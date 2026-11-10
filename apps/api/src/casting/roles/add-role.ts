import { type AddRoleRefusal, AddRoleRequest } from "@app/shared";
import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import type { CastStore } from "#/show/cast/cast-store.ts";
import {
  latestOrderWith,
  type RunningOrderStore,
} from "#/show/running-order/running-order-store.ts";
import { castingRefusal, gangOfItem } from "./castable.ts";
import type { RoleStore } from "./role-store.ts";

// POST /api/productions/{productionId}/items/{itemId}/roles: add a role to an item,
// optionally casting members of this production's cast, in the item's gang, in it.
export function createAddRole(
  roles: RoleStore,
  runningOrders: RunningOrderStore,
  cast: CastStore,
): Handler {
  return inProduction(async (productionId, event) => {
    const itemId = event.pathParameters?.itemId;
    if (!itemId) return { statusCode: 404 };
    // The body is checked first, so a bad request is a 400 whatever the item.
    // Strict: unknown fields (e.g. a copied name) are refused, not quietly dropped.
    const details = AddRoleRequest.safeParse(parseJson(event.body));
    if (!details.success) return { statusCode: 400 };

    // Roles belong to items in the latest saved running order (PRD constraints).
    const order = await latestOrderWith(runningOrders, productionId, itemId);
    if (!order) return { statusCode: 404 };

    const { castMemberIds } = details.data;
    const refusal = await castingRefusal(
      cast,
      productionId,
      castMemberIds,
      gangOfItem(order, itemId),
    );
    if (refusal) return refusal;

    const role = await roles.add(productionId, itemId, details.data);
    if (role === "name-taken") {
      return jsonResponse(400, { error: "name-taken" } satisfies AddRoleRefusal);
    }
    return jsonResponse(201, role);
  });
}
