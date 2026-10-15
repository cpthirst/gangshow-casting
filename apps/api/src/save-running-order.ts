import { ProductionId, type RunningOrder, SaveRunningOrderRequest } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "./handler.ts";
import { parseJson } from "./json.ts";
import { applyChange } from "./running-order-changes.ts";
import type { RunningOrderStore } from "./running-order-store.ts";

const json = (statusCode: number, order: RunningOrder): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(order),
});

// POST /api/productions/{productionId}/running-order/versions: apply one change to the
// latest version and save the result as the next version.
export function createSaveRunningOrder(store: RunningOrderStore, now = () => new Date()) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    if (!productionId.success) return { statusCode: 404 };
    const request = SaveRunningOrderRequest.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };

    const latest = await store.latest(productionId.data);
    if (!latest) return { statusCode: 404 };
    // Someone else saved since this client last looked: send them the latest instead.
    if (request.data.baseVersion !== latest.version) return json(409, latest);

    const result = applyChange(latest, request.data.change);
    if (!result.ok) return { statusCode: 400 };

    const next = { ...result.order, version: latest.version + 1, savedAt: now().toISOString() };
    if ((await store.save(next)) === "conflict") {
      const newer = await store.latest(productionId.data);
      return newer ? json(409, newer) : { statusCode: 409 };
    }
    return json(201, next);
  };
}
