import { type AddRoleRefusal, AddRoleRequest } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import { productionIdOf } from "#/http/params.ts";
import { areCastMembers } from "#/show/cast/cast-members.ts";
import type { CastStore } from "#/show/cast/cast-store.ts";
import type { RunningOrderStore } from "#/show/running-order/running-order-store.ts";
import type { RoleStore } from "./role-store.ts";

// POST /api/productions/{productionId}/items/{itemId}/roles: add a role to an item,
// optionally casting members of this production's cast in it.
export function createAddRole(roles: RoleStore, runningOrders: RunningOrderStore, cast: CastStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    const itemId = event.pathParameters?.itemId;
    if (productionId === undefined || !itemId) return { statusCode: 404 };
    // The body is checked first, so a bad request is a 400 whatever the item.
    // Strict: unknown fields (e.g. a copied name) are refused, not quietly dropped.
    const details = AddRoleRequest.safeParse(parseJson(event.body));
    if (!details.success) return { statusCode: 400 };

    // Roles belong to items in the latest saved running order (PRD constraints).
    const order = await runningOrders.latest(productionId);
    const inShow = order?.halves.some((half) => half.items.some((item) => item.id === itemId));
    if (!inShow) return { statusCode: 404 };

    if (!(await areCastMembers(cast, productionId, details.data.castMemberIds))) {
      return { statusCode: 400 };
    }

    const role = await roles.add(productionId, itemId, details.data);
    if (role === "name-taken") {
      return jsonResponse(400, { error: "name-taken" } satisfies AddRoleRefusal);
    }
    return jsonResponse(201, role);
  };
}
