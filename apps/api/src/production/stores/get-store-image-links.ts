import { storeOf } from "@app/shared";
import type { Handler } from "#/http/handler.ts";
import { imageLinksResponse } from "#/production/item-files/file-link-responses.ts";
import type { StoreImageStore } from "./store-image-store.ts";

// GET /api/stores/{storeId}/image-links: a short-lived link to each of the store's images, so
// its page takes one request for them all (stores FR6, ADR 0043). Open to every signed-in
// role. 404 for a department with no store.
export function createGetStoreImageLinks(images: StoreImageStore): Handler {
  return async (event) => {
    const store = storeOf(event.pathParameters?.storeId);
    if (store === undefined) return { statusCode: 404 };
    return imageLinksResponse(await images.list(store), (name) => images.linkTo(store, name));
  };
}
