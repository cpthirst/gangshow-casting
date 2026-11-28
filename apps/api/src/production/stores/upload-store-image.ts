import { ItemFileUploadRequest, isGalleryImage, storeOf } from "@app/shared";
import type { Handler } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import type { StoreImageStore } from "./store-image-store.ts";

// POST /api/stores/{storeId}/uploads: where the browser may send one image, straight to file
// storage, which refuses it over 100 MB (stores FR12, ADR 0043). Only the store's own
// permissions, or an admin, get here (stores.ts in @app/shared). 400 for anything the store's
// gallery wouldn't show, as a store keeps only images; 409 for a name the store already has,
// unless the request says it replaces it.
export function createUploadStoreImage(images: StoreImageStore): Handler {
  return async (event) => {
    const store = storeOf(event.pathParameters?.storeId);
    if (store === undefined) return { statusCode: 404 };
    // A valid name can't reach outside the store's folder.
    const request = ItemFileUploadRequest.safeParse(parseJson(event.body));
    if (!request.success || !isGalleryImage(request.data.name)) return { statusCode: 400 };

    const { name, replace = false } = request.data;
    const upload = await images.uploadTo(store, name, { replace });
    if (upload === "taken") return { statusCode: 409 };
    return jsonResponse(200, upload);
  };
}
