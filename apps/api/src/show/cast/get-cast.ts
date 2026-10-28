import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import { productionIdOf } from "#/http/params.ts";
import type { CastStore } from "./cast-store.ts";

// GET /api/productions/{productionId}/cast: the production's cast list.
export function createGetCast(store: CastStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    if (productionId === undefined) return { statusCode: 404 };
    const list = await store.list(productionId);
    if (!list) return { statusCode: 404 };
    return jsonResponse(200, list);
  };
}
