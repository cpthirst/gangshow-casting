import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { productionIdOf, wholeNumber } from "#/http/params.ts";
import { type CastingFollowers, productionFollowsCasting } from "#/production/follow-casting.ts";
import type { RoleStore } from "./role-store.ts";

// DELETE /api/productions/{productionId}/roles/{roleId}?revision=N: remove a role for good,
// with whoever was cast in it, unless someone else changed it since revision N. Its cast
// stop carrying the props linked to it (production-props FR28), and lose their mic in the
// item if they're in none of its roles now (production-mics FR9).
export function createRemoveRole(roles: RoleStore, followers: CastingFollowers) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    const roleId = wholeNumber(event.pathParameters?.roleId);
    if (productionId === undefined || roleId === undefined) return { statusCode: 404 };
    const revision = wholeNumber(event.queryStringParameters?.revision);
    if (revision === undefined) return { statusCode: 400 };

    const result = await roles.remove(productionId, roleId, revision);
    if (result === "stale") return { statusCode: 409 };
    if (result === "not-found") return { statusCode: 404 };
    await productionFollowsCasting(followers, roles, productionId);
    return { statusCode: 204 };
  };
}
