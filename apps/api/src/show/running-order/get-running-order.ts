import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import type { RunningOrderStore } from "./running-order-store.ts";

// GET /api/productions/{productionId}/running-order: the latest saved version.
export function createGetRunningOrder(store: RunningOrderStore): Handler {
  return inProduction(async (productionId) => {
    const order = await store.latest(productionId);
    if (!order) return { statusCode: 404 };
    return jsonResponse(200, order);
  });
}
