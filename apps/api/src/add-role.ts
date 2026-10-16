import { AddRoleRequest, ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "./handler.ts";
import { parseJson } from "./json.ts";
import type { RoleStore } from "./role-store.ts";
import type { RunningOrderStore } from "./running-order-store.ts";

// POST /api/productions/{productionId}/items/{itemId}/roles: add an uncast role to an item.
export function createAddRole(roles: RoleStore, runningOrders: RunningOrderStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    const itemId = event.pathParameters?.itemId;
    if (!productionId.success || !itemId) return { statusCode: 404 };
    // The body is checked first, so a bad request is a 400 whatever the item.
    // Strict: unknown fields (e.g. a copied name) are refused, not quietly dropped.
    const details = AddRoleRequest.safeParse(parseJson(event.body));
    if (!details.success) return { statusCode: 400 };

    // Roles belong to items in the latest saved running order (PRD constraints).
    const order = await runningOrders.latest(productionId.data);
    const inShow = order?.halves.some((half) => half.items.some((item) => item.id === itemId));
    if (!inShow) return { statusCode: 404 };

    const role = await roles.add(productionId.data, itemId, details.data);
    return {
      statusCode: 201,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(role),
    };
  };
}
