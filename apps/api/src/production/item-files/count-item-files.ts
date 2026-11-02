import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import { productionIdOf } from "#/http/params.ts";
import type { ItemFileStore } from "./item-file-store.ts";

// GET /api/productions/{productionId}/<department>-file-counts: how many files each item has,
// for the Overview's Scenery, SFX or Wardrobe column (production-overview FR14,
// production-sfx-wardrobe FR10). Open to every signed-in role, as the files themselves are.
export function createCountItemFiles(store: ItemFileStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    if (productionId === undefined) return { statusCode: 404 };
    return jsonResponse(200, { counts: await store.countByItem(productionId) });
  };
}
