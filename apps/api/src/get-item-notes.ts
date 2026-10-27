import { ProductionId } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "./handler.ts";
import type { ItemNoteStore } from "./item-note-store.ts";

// GET /api/productions/{productionId}/item-notes: every item's notes (casting-item-overview
// FR8, FR9). Also serves /props-notes, from the props notes store (production-props FR20).
export function createGetItemNotes(store: ItemNoteStore) {
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
