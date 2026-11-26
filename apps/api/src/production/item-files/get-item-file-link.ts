import { ItemFileLinkQuery } from "@app/shared";
import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import { folderIdOf } from "#/http/params.ts";
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
    const query = ItemFileLinkQuery.safeParse(event.queryStringParameters ?? {});
    if (!query.success) return { statusCode: 400 };
    const { name, download } = query.data;
    const url = await store.linkTo(productionId, itemId, name, { download: download === "true" });
    if (url === undefined) return { statusCode: 404 };
    // Anyone holding the link can use it for a while, so nothing on the way may keep it.
    const res = jsonResponse(200, { url });
    return { ...res, headers: { ...res.headers, "cache-control": "no-store" } };
  });
}
