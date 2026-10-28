import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import { productionIdOf } from "#/http/params.ts";
import type { ItemNoteStore } from "./item-note-store.ts";

// GET /api/productions/{productionId}/item-notes: every item's notes (casting-item-overview
// FR8, FR9). Also serves /props-notes, from the props notes store (production-props FR20).
export function createGetItemNotes(store: ItemNoteStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    if (productionId === undefined) return { statusCode: 404 };
    return jsonResponse(200, await store.list(productionId));
  };
}
