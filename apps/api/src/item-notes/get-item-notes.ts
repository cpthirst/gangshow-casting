import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import type { ItemNoteStore } from "./item-note-store.ts";

// GET /api/productions/{productionId}/item-notes: every item's notes (casting-item-overview
// FR8, FR9). Also serves /props-notes, /scenery-notes, /sfx-notes, /wardrobe-notes and
// /mic-plot-notes, each from its own store (production-props FR20, production-scenery E2.S1,
// production-sfx-wardrobe FR8, production-mics FR8).
export function createGetItemNotes(store: ItemNoteStore): Handler {
  return inProduction(async (productionId) => {
    return jsonResponse(200, await store.list(productionId));
  });
}
