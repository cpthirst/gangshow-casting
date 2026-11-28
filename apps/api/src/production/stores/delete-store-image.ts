import { ItemFileName, storeOf } from "@app/shared";
import type { Handler } from "#/http/handler.ts";
import type { StoreImageStore } from "./store-image-store.ts";

// DELETE /api/stores/{storeId}/images?name=…: delete one of the store's images for good
// (stores FR19). Only the store's own permissions, or an admin, get here (stores.ts in
// @app/shared). 404 for a department with no store, or an image already gone, so the page can
// say so. An image's description goes with it, once images have descriptions (stores E3.S1).
export function createDeleteStoreImage(images: StoreImageStore): Handler {
  return async (event) => {
    const store = storeOf(event.pathParameters?.storeId);
    if (store === undefined) return { statusCode: 404 };
    // A valid name can't reach outside the store's folder.
    const name = ItemFileName.safeParse(event.queryStringParameters?.name);
    if (!name.success) return { statusCode: 400 };
    const result = await images.remove(store, name.data);
    return { statusCode: result === "removed" ? 204 : 404 };
  };
}
