import { ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "./handler.ts";
import type { RunningOrderStore } from "./running-order-store.ts";

// GET /api/productions/{productionId}/running-order: the latest saved version.
export function createGetRunningOrder(store: RunningOrderStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    const order = productionId.success ? await store.latest(productionId.data) : undefined;
    if (!order) return { statusCode: 404 };
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(order),
    };
  };
}
