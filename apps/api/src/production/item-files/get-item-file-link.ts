import { type Handler, inProduction } from "#/http/handler.ts";
import { folderIdOf } from "#/http/params.ts";
import { fileLinkResponse } from "./file-link-responses.ts";
import type { ItemFileStore } from "./item-file-store.ts";

// GET /api/productions/{productionId}/items/{itemId}/scenery-file-link?name=…, or
// /sfx-file-link or /wardrobe-file-link: a short-lived link that opens or downloads one of the item's files
// (production-scenery FR10), or with &download=true always downloads it (production-image-gallery
// FR10). Open to every signed-in role. 404 if the file isn't there any
// more, so the page can say so.
export function createGetItemFileLink(store: ItemFileStore): Handler {
  return inProduction(async (productionId, event) => {
    const itemId = folderIdOf(event.pathParameters?.itemId);
    if (itemId === undefined) return { statusCode: 404 };
    return fileLinkResponse(event, (name, options) =>
      store.linkTo(productionId, itemId, name, options),
    );
  });
}
