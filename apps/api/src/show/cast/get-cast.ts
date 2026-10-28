import { ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import type { CastStore } from "./cast-store.ts";

// GET /api/productions/{productionId}/cast: the production's cast list.
export function createGetCast(store: CastStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    const list = productionId.success ? await store.list(productionId.data) : undefined;
    if (!list) return { statusCode: 404 };
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(list),
    };
  };
}
