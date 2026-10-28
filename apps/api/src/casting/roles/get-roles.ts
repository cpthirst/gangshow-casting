import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import { productionIdOf } from "#/http/params.ts";
import type { RoleStore } from "./role-store.ts";

// GET /api/productions/{productionId}/roles: every role in the production.
export function createGetRoles(store: RoleStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    if (productionId === undefined) return { statusCode: 404 };
    return jsonResponse(200, await store.list(productionId));
  };
}
