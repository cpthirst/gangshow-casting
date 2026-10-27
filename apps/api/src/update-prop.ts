import { ProductionId, UpdatePropRequest } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "./handler.ts";
import { parseJson } from "./json.ts";
import { wholeNumber } from "./params.ts";
import { linksFitItem } from "./prop-links.ts";
import type { PropStore } from "./prop-store.ts";
import type { RoleStore } from "./role-store.ts";

// PUT /api/productions/{productionId}/props/{propId}: replace a prop's name, quantity, roles
// and carriers (production-props FR19, FR24, FR26). Only Stage or an admin get here
// (routeNeeds in @app/shared).
export function createUpdateProp(props: PropStore, roles: RoleStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    const propId = wholeNumber(event.pathParameters?.propId);
    if (!productionId.success || propId === undefined) return { statusCode: 404 };
    // Strict: an id, item or any unknown field in the body is refused.
    const details = UpdatePropRequest.safeParse(parseJson(event.body));
    if (!details.success) return { statusCode: 400 };

    const prop = (await props.list(productionId.data)).props.find(({ id }) => id === propId);
    if (!prop) return { statusCode: 404 };
    const itemRoles = (await roles.list(productionId.data)).roles.filter(
      (role) => role.itemId === prop.itemId,
    );
    if (!linksFitItem(details.data, itemRoles)) return { statusCode: 400 };

    const updated = await props.update(productionId.data, propId, details.data);
    // Removed by someone else since it was read above.
    if (updated === "not-found") return { statusCode: 404 };
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(updated),
    };
  };
}
