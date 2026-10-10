import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "./routes.ts";
import { isValidProductionId, type RunningOrderStore } from "./running-order-store.ts";

// GET /api/productions/{productionId}/running-order: the latest saved version.
export function createGetRunningOrder(store: RunningOrderStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = event.pathParameters?.productionId ?? "";
    const order = isValidProductionId(productionId) ? await store.latest(productionId) : undefined;
    if (!order) return { statusCode: 404 };
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(order),
    };
  };
}
