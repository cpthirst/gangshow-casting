import { ProductionId, type RunningOrder, SaveRunningOrderRequest } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiEvent } from "./handler.ts";
import type { ItemNoteStore } from "./item-note-store.ts";
import { parseJson } from "./json.ts";
import type { RoleStore } from "./role-store.ts";
import { applyChange } from "./running-order-changes.ts";
import type { RunningOrderStore } from "./running-order-store.ts";

const json = (statusCode: number, order: RunningOrder): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(order),
});

/** Where the casting kept about each item lives: it goes when the item leaves the show. */
export interface CastingCleanup {
  roles: Pick<RoleStore, "keepOnlyItems">;
  itemNotes: Pick<ItemNoteStore, "keepOnlyItems">;
}

// POST /api/productions/{productionId}/running-order/versions: apply one change to the
// latest version and save the result as the next version.
export function createSaveRunningOrder(
  store: RunningOrderStore,
  casting: CastingCleanup,
  now = () => new Date(),
) {
  return async (event: ApiEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    const productionId = ProductionId.safeParse(event.pathParameters?.productionId);
    if (!productionId.success) return { statusCode: 404 };
    const request = SaveRunningOrderRequest.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };

    const latest = await store.latest(productionId.data);
    if (!latest) return { statusCode: 404 };
    // Someone else saved since this client last looked: send them the latest instead.
    if (request.data.baseVersion !== latest.version) return json(409, latest);

    const result = applyChange(latest, request.data.change);
    if (!result.ok) return { statusCode: 400 };

    const next = { ...result.order, version: latest.version + 1, savedAt: now().toISOString() };
    if ((await store.save(next)) === "conflict") {
      const newer = await store.latest(productionId.data);
      return newer ? json(409, newer) : { statusCode: 409 };
    }
    await removeCastingOfDroppedItems(store, casting, productionId.data, next);
    return json(201, next);
  };
}

/**
 * Nothing about a removed item is kept (ADR 0010). Only after the version is saved, so a
 * refused save deletes nothing. It keeps the items of the newest version, which a later save
 * may have added to, and removes everything else, not just this save's removals: if it
 * fails, the next save finishes the job. The version is saved either way, so a failure is
 * logged rather than reported to the user as a failed save.
 */
async function removeCastingOfDroppedItems(
  store: RunningOrderStore,
  casting: CastingCleanup,
  productionId: string,
  saved: RunningOrder,
) {
  try {
    const newest = (await store.latest(productionId)) ?? saved;
    const itemIds = newest.halves.flatMap((half) => half.items).map((item) => item.id);
    await casting.roles.keepOnlyItems(productionId, itemIds);
    await casting.itemNotes.keepOnlyItems(productionId, itemIds);
    // A dropped item's props and props notes are kept, for now: whether they go too is an open
    // question in docs/product/production/props/prd.md, to settle before item removal is built.
  } catch (error) {
    // Only the error's name: a store's message can quote stored casting (ADR 0010).
    console.error(
      `Couldn't remove dropped items' casting in production ${productionId}: ${error instanceof Error ? error.name : "unknown error"}`,
    );
  }
}
