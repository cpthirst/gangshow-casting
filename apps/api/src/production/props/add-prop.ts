import { PropDetails } from "@app/shared";
import type { RoleStore } from "#/casting/roles/role-store.ts";
import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import {
  latestOrderWith,
  type RunningOrderStore,
} from "#/show/running-order/running-order-store.ts";
import { linksFitItem } from "./prop-links.ts";
import type { PropStore } from "./prop-store.ts";

// POST /api/productions/{productionId}/items/{itemId}/props: add a prop to an item
// (production-props FR17). Only Stage or an admin get here (routeNeeds in @app/shared).
export function createAddProp(
  props: PropStore,
  runningOrders: RunningOrderStore,
  roles: RoleStore,
): Handler {
  return inProduction(async (productionId, event) => {
    const itemId = event.pathParameters?.itemId;
    if (!itemId) return { statusCode: 404 };
    // The body is checked first, so a bad request is a 400 whatever the item.
    const details = PropDetails.safeParse(parseJson(event.body));
    if (!details.success) return { statusCode: 400 };

    // Props belong to items in the latest saved running order, as roles do.
    if (!(await latestOrderWith(runningOrders, productionId, itemId))) return { statusCode: 404 };

    const itemRoles = (await roles.list(productionId)).roles.filter(
      (role) => role.itemId === itemId,
    );
    if (!linksFitItem(details.data, itemRoles)) return { statusCode: 400 };

    return jsonResponse(201, await props.add(productionId, itemId, details.data));
  });
}
