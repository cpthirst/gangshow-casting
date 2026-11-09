import { PropDetails } from "@app/shared";
import type { RoleStore } from "#/casting/roles/role-store.ts";
import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import { wholeNumber } from "#/http/params.ts";
import { linksFitItem } from "./prop-links.ts";
import type { PropStore } from "./prop-store.ts";

// PUT /api/productions/{productionId}/props/{propId}: replace a prop's name, quantity, roles
// and carriers (production-props FR19, FR24, FR26). Only Stage or an admin get here
// (routeNeeds in @app/shared).
export function createUpdateProp(props: PropStore, roles: RoleStore): Handler {
  return inProduction(async (productionId, event) => {
    const propId = wholeNumber(event.pathParameters?.propId);
    if (propId === undefined) return { statusCode: 404 };
    // Strict: an id, item or any unknown field in the body is refused.
    const details = PropDetails.safeParse(parseJson(event.body));
    if (!details.success) return { statusCode: 400 };

    const prop = (await props.list(productionId)).props.find(({ id }) => id === propId);
    if (!prop) return { statusCode: 404 };
    const itemRoles = (await roles.list(productionId)).roles.filter(
      (role) => role.itemId === prop.itemId,
    );
    if (!linksFitItem(details.data, itemRoles)) return { statusCode: 400 };

    const updated = await props.update(productionId, propId, details.data);
    // Removed by someone else since it was read above.
    if (updated === "not-found") return { statusCode: 404 };
    return jsonResponse(200, updated);
  });
}
