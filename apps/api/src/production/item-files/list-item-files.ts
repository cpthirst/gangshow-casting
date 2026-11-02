import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import { folderIdOf, productionIdOf } from "#/http/params.ts";
import type { ItemFileStore } from "./item-file-store.ts";

// GET /api/productions/{productionId}/items/{itemId}/scenery-files, or /sfx-files or /wardrobe-files: the item's
// files, as file storage holds them now (production-scenery FR6, FR7). Open to every
// signed-in role.
export function createListItemFiles(store: ItemFileStore) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = productionIdOf(event);
    const itemId = folderIdOf(event.pathParameters?.itemId);
    if (productionId === undefined || itemId === undefined) return { statusCode: 404 };
    return jsonResponse(200, { files: await store.list(productionId, itemId) });
  };
}
