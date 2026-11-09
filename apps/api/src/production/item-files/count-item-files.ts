import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import type { ItemFileStore } from "./item-file-store.ts";

// GET /api/productions/{productionId}/<department>-file-counts: how many files each item has,
// for the Overview's Scenery, SFX or Wardrobe column (production-overview FR14,
// production-sfx-wardrobe FR10). Open to every signed-in role, as the files themselves are.
export function createCountItemFiles(store: ItemFileStore): Handler {
  return inProduction(async (productionId) => {
    return jsonResponse(200, { counts: await store.countByItem(productionId) });
  });
}
