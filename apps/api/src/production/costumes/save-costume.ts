import { type Costume, RunningOrderItem, SaveCostumeRequest } from "@app/shared";
import type { RoleStore } from "#/casting/roles/role-store.ts";
import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import {
  latestOrderWith,
  type RunningOrderStore,
} from "#/show/running-order/running-order-store.ts";
import { type CostumeStore, sameRow } from "./costume-store.ts";

// PUT /api/productions/{productionId}/items/{itemId}/costumes: save one row's three fields
// together, for a cast member in one of the item's roles, unless someone else saved the row
// since the revision in the body (production-costume-sheets FR5, FR7).
// Only Wardrobe, a Director or an admin get here (routeNeeds in @app/shared).

/** How many times to read the role again when it moves on under a save (the remote store
 *  refuses a save once its role changes): plenty for a handful of volunteers. */
const ATTEMPTS = 3;

export function createSaveCostume(
  costumes: CostumeStore,
  runningOrders: RunningOrderStore,
  roles: RoleStore,
): Handler {
  return inProduction(async (productionId, event) => {
    const itemId = RunningOrderItem.shape.id.safeParse(event.pathParameters?.itemId);
    if (!itemId.success) return { statusCode: 404 };
    // The body is checked first, so a bad request is a 400 whatever the item.
    const request = SaveCostumeRequest.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };

    // Costumes belong to items in the latest saved running order, as roles do.
    if (!(await latestOrderWith(runningOrders, productionId, itemId.data)))
      return { statusCode: 404 };

    const { revision, ...fields } = request.data;
    const change = { itemId: itemId.data, ...fields };
    const currentRow = async () =>
      (await costumes.list(productionId)).costumes.find((c) => sameRow(c, change));
    let current: Costume | undefined;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const role = (await roles.list(productionId)).roles.find(
        (r) => r.id === fields.roleId && r.itemId === itemId.data,
      );
      if (!role?.castMemberIds.includes(fields.castMemberId)) return { statusCode: 400 };

      const saved = await costumes.save(productionId, change, revision, role);
      if (saved !== "stale") return jsonResponse(200, saved);
      current = await currentRow();
      // Someone else saved the row first. Otherwise only the role moved on: read it again.
      if ((current?.revision ?? 0) !== revision) break;
    }
    // Send them the row as it is now, as the running order does. Bare when there's no row to
    // send, as when the role kept moving on; the page then says the save failed, and a try
    // again sees the change.
    return current ? jsonResponse(409, current) : { statusCode: 409 };
  });
}
