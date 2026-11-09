import { ItemFileName } from "@app/shared";
import { type Handler, inProduction } from "#/http/handler.ts";
import { folderIdOf } from "#/http/params.ts";
import type { ItemFileStore } from "./item-file-store.ts";

// DELETE /api/productions/{productionId}/items/{itemId}/scenery-files?name=…, or /sfx-files or /wardrobe-files:
// delete one of the item's files for good (production-scenery FR11, production-sfx-wardrobe
// FR7). Only those the department's routeNeeds name get here (@app/shared). 404 if it's
// already gone, so the page can say so.
export function createDeleteItemFile(store: ItemFileStore): Handler {
  return inProduction(async (productionId, event) => {
    const itemId = folderIdOf(event.pathParameters?.itemId);
    if (itemId === undefined) return { statusCode: 404 };
    // A valid name can't reach outside the item's folder.
    const name = ItemFileName.safeParse(event.queryStringParameters?.name);
    if (!name.success) return { statusCode: 400 };
    const result = await store.remove(productionId, itemId, name.data);
    return { statusCode: result === "removed" ? 204 : 404 };
  });
}
