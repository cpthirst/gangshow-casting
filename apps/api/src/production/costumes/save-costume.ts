import { RunningOrderItem, SaveCostumeRequest } from "@app/shared";
import type { RoleStore } from "#/casting/roles/role-store.ts";
import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import {
  latestOrderWith,
  type RunningOrderStore,
} from "#/show/running-order/running-order-store.ts";
import type { CostumeStore } from "./costume-store.ts";

// PUT /api/productions/{productionId}/items/{itemId}/costumes: save one row's three fields
// together, for a cast member in one of the item's roles (production-costume-sheets FR5, FR7).
// Only Wardrobe, a Director or an admin get here (routeNeeds in @app/shared).
export function createSaveCostume(
  costumes: CostumeStore,
  runningOrders: RunningOrderStore,
  roles: RoleStore,
): Handler {
  return inProduction(async (productionId, event) => {
    const itemId = RunningOrderItem.shape.id.safeParse(event.pathParameters?.itemId);
    if (!itemId.success) return { statusCode: 404 };
    // The body is checked first, so a bad request is a 400 whatever the item.
    const request = SaveCostumeRequest.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };

    // Costumes belong to items in the latest saved running order, as roles do.
    if (!(await latestOrderWith(runningOrders, productionId, itemId.data)))
      return { statusCode: 404 };

    const { roleId, castMemberId } = request.data;
    const role = (await roles.list(productionId)).roles.find(
      (r) => r.id === roleId && r.itemId === itemId.data,
    );
    if (!role?.castMemberIds.includes(castMemberId)) return { statusCode: 400 };

    return jsonResponse(
      200,
      await costumes.save(productionId, { itemId: itemId.data, ...request.data }),
    );
  });
}
