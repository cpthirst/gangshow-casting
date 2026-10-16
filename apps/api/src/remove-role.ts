import { ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "./handler.ts";
import { wholeNumber } from "./params.ts";
import type { RoleStore } from "./role-store.ts";

// DELETE /api/productions/{productionId}/roles/{roleId}?revision=N: remove a role for good,
// with whoever was cast in it, unless someone else changed it since revision N.
export function createRemoveRole(roles: RoleStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    const roleId = wholeNumber(event.pathParameters?.roleId);
    if (!productionId.success || roleId === undefined) return { statusCode: 404 };
    const revision = wholeNumber(event.queryStringParameters?.revision);
    if (revision === undefined) return { statusCode: 400 };

    const result = await roles.remove(productionId.data, roleId, revision);
    if (result === "stale") return { statusCode: 409 };
    if (result === "not-found") return { statusCode: 404 };
    return { statusCode: 204 };
  };
}
