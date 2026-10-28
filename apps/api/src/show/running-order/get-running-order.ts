import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import { productionIdOf } from "#/http/params.ts";
import type { RunningOrderStore } from "./running-order-store.ts";

// GET /api/productions/{productionId}/running-order: the latest saved version.
export function createGetRunningOrder(store: RunningOrderStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    if (productionId === undefined) return { statusCode: 404 };
    const order = await store.latest(productionId);
    if (!order) return { statusCode: 404 };
    return jsonResponse(200, order);
  };
}
