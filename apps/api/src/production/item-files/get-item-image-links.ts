import { isGalleryImage } from "@app/shared";
import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import { folderIdOf } from "#/http/params.ts";
import {
  latestOrderWith,
  type RunningOrderStore,
} from "#/show/running-order/running-order-store.ts";
import type { ItemFileStore } from "./item-file-store.ts";

// GET /api/productions/{productionId}/items/{itemId}/scenery-image-links, or /sfx-image-links
// or /wardrobe-image-links: a short-lived link to each of the item's images, so the page's
// thumbnails take one request, not one each (production-image-gallery FR1, ADR 0042). Open to
// every signed-in role. 404 for an item not in the latest saved running order.
export function createGetItemImageLinks(
  store: ItemFileStore,
  runningOrders: RunningOrderStore,
): Handler {
  return inProduction(async (productionId, event) => {
    const itemId = folderIdOf(event.pathParameters?.itemId);
    if (itemId === undefined) return { statusCode: 404 };
    if (!(await latestOrderWith(runningOrders, productionId, itemId))) return { statusCode: 404 };

    const images = (await store.list(productionId, itemId)).filter(({ name }) =>
      isGalleryImage(name),
    );
    const linked = await Promise.all(
      images.map(async ({ name }) => {
        // Gone since the list, if deleted meanwhile: left out, as the next list will be.
        const url = await store.linkTo(productionId, itemId, name);
        return url === undefined ? [] : [{ name, url }];
      }),
    );
    // Anyone holding the links can use them for a while, so nothing on the way may keep them.
    const res = jsonResponse(200, { links: linked.flat() });
    return { ...res, headers: { ...res.headers, "cache-control": "no-store" } };
  });
}
