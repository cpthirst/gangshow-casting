import { AddPropRequest } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { RoleStore } from "#/casting/roles/role-store.ts";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import { productionIdOf } from "#/http/params.ts";
import type { RunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { linksFitItem } from "./prop-links.ts";
import type { PropStore } from "./prop-store.ts";

// POST /api/productions/{productionId}/items/{itemId}/props: add a prop to an item
// (production-props FR17). Only Stage or an admin get here (routeNeeds in @app/shared).
export function createAddProp(
  props: PropStore,
  runningOrders: RunningOrderStore,
  roles: RoleStore,
) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    const itemId = event.pathParameters?.itemId;
    if (productionId === undefined || !itemId) return { statusCode: 404 };
    // The body is checked first, so a bad request is a 400 whatever the item.
    const details = AddPropRequest.safeParse(parseJson(event.body));
    if (!details.success) return { statusCode: 400 };

    // Props belong to items in the latest saved running order, as roles do.
    const order = await runningOrders.latest(productionId);
    const inShow = order?.halves.some((half) => half.items.some((item) => item.id === itemId));
    if (!inShow) return { statusCode: 404 };

    const itemRoles = (await roles.list(productionId)).roles.filter(
      (role) => role.itemId === itemId,
    );
    if (!linksFitItem(details.data, itemRoles)) return { statusCode: 400 };

    return jsonResponse(201, await props.add(productionId, itemId, details.data));
  };
}
