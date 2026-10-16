import { ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "./handler.ts";
import type { RoleStore } from "./role-store.ts";

// GET /api/productions/{productionId}/roles: every role in the production.
export function createGetRoles(store: RoleStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    if (!productionId.success) return { statusCode: 404 };
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(await store.list(productionId.data)),
    };
  };
}
