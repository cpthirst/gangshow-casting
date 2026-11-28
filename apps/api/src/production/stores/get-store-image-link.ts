import { isGalleryImage, storeOf } from "@app/shared";
import type { Handler } from "#/http/handler.ts";
import { fileLinkResponse } from "#/production/item-files/file-link-responses.ts";
import type { StoreImageStore } from "./store-image-store.ts";

// GET /api/stores/{storeId}/image-link?name=…: a short-lived link that opens one of the
// store's images, or with &download=true saves it, as the viewer's Open and Download ask
// (stores FR6, ADR 0043). Open to every signed-in role. 404 for a department with no store, a
// file that isn't an image, or an image that isn't there any more.
export function createGetStoreImageLink(images: StoreImageStore): Handler {
  return async (event) => {
    const store = storeOf(event.pathParameters?.storeId);
    if (store === undefined) return { statusCode: 404 };
    // A store keeps only images, so a link to anything else put there is never given.
    return fileLinkResponse(
      event,
      (name, options) => images.linkTo(store, name, options),
      isGalleryImage,
    );
  };
}
