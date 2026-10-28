import { ProductionId, RunningOrderItem, SaveItemNoteRequest } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { parseJson } from "#/http/json.ts";
import type { RunningOrderStore } from "#/show/running-order/running-order-store.ts";
import type { ItemNoteStore } from "./item-note-store.ts";

// PUT /api/productions/{productionId}/items/{itemId}/notes: replace an item's notes, unless
// someone else saved them since the revision in the body (casting-item-overview FR8, FR10).
// Also saves props notes at /props-notes, into their own store (production-props FR20).
export function createSaveItemNote(notes: ItemNoteStore, runningOrders: RunningOrderStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    const itemId = RunningOrderItem.shape.id.safeParse(event.pathParameters?.itemId);
    if (!productionId.success || !itemId.success) return { statusCode: 404 };
    const request = SaveItemNoteRequest.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };

    // Only items in the latest saved running order can have notes.
    const order = await runningOrders.latest(productionId.data);
    const inShow = order?.halves.some((half) => half.items.some((item) => item.id === itemId.data));
    if (!inShow) return { statusCode: 404 };

    const { revision, text } = request.data;
    const saved = await notes.save(productionId.data, itemId.data, revision, text);
    if (saved === "stale") return { statusCode: 409 };
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(saved),
    };
  };
}
