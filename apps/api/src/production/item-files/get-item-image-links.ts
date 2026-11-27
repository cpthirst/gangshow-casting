import { type Handler, inProduction } from "#/http/handler.ts";
import { folderIdOf } from "#/http/params.ts";
import {
  latestOrderWith,
  type RunningOrderStore,
} from "#/show/running-order/running-order-store.ts";
import { imageLinksResponse } from "./file-link-responses.ts";
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

    return imageLinksResponse(await store.list(productionId, itemId), (name) =>
      store.linkTo(productionId, itemId, name),
    );
  });
}
