import { AddPropRequest, ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "./handler.ts";
import { parseJson } from "./json.ts";
import type { PropStore } from "./prop-store.ts";
import type { RoleStore } from "./role-store.ts";
import type { RunningOrderStore } from "./running-order-store.ts";

// POST /api/productions/{productionId}/items/{itemId}/props: add a prop to an item
// (production-props FR17). Only Stage or an admin get here (routeNeeds in @app/shared).
export function createAddProp(
  props: PropStore,
  runningOrders: RunningOrderStore,
  roles: RoleStore,
) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    const itemId = event.pathParameters?.itemId;
    if (!productionId.success || !itemId) return { statusCode: 404 };
    // The body is checked first, so a bad request is a 400 whatever the item.
    const details = AddPropRequest.safeParse(parseJson(event.body));
    if (!details.success) return { statusCode: 400 };

    // Props belong to items in the latest saved running order, as roles do.
    const order = await runningOrders.latest(productionId.data);
    const inShow = order?.halves.some((half) => half.items.some((item) => item.id === itemId));
    if (!inShow) return { statusCode: 404 };

    // A prop links only to its own item's roles (production-props FR18).
    const itemRoleIds = (await roles.list(productionId.data)).roles
      .filter((role) => role.itemId === itemId)
      .map((role) => role.id);
    if (!details.data.roleIds.every((id) => itemRoleIds.includes(id))) {
      return { statusCode: 400 };
    }

    return {
      statusCode: 201,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(await props.add(productionId.data, itemId, details.data)),
    };
  };
}
