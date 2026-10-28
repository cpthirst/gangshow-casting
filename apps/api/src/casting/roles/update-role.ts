import { type AddRoleRefusal, UpdateRoleRequest } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import { productionIdOf, wholeNumber } from "#/http/params.ts";
import { carriersFollowCasting } from "#/production/props/prop-links.ts";
import type { PropStore } from "#/production/props/prop-store.ts";
import { areCastMembers } from "#/show/cast/cast-members.ts";
import type { CastStore } from "#/show/cast/cast-store.ts";
import type { RoleStore } from "./role-store.ts";

// PUT /api/productions/{productionId}/roles/{roleId}: replace a role's name, size and cast,
// unless someone else changed it since the revision in the body (casting-roles FR4, FR8).
// Anyone taken out of it stops carrying its props (production-props FR28).
export function createUpdateRole(roles: RoleStore, cast: CastStore, props: PropStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    const roleId = wholeNumber(event.pathParameters?.roleId);
    if (productionId === undefined || roleId === undefined) return { statusCode: 404 };
    // Strict: an id or any unknown field in the body is refused.
    const request = UpdateRoleRequest.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };

    const { revision, ...details } = request.data;
    if (!(await areCastMembers(cast, productionId, details.castMemberIds))) {
      return { statusCode: 400 };
    }
    const result = await roles.update(productionId, roleId, revision, details);
    if (result === "name-taken") {
      return jsonResponse(400, { error: "name-taken" } satisfies AddRoleRefusal);
    }
    if (result === "stale") return { statusCode: 409 };
    if (result === "not-found") return { statusCode: 404 };
    await carriersFollowCasting(props, roles, productionId);
    return jsonResponse(200, result);
  };
}
