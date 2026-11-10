import {
  itemsChangingGang,
  itemsOf,
  type RunningOrder,
  SaveRunningOrderRequest,
} from "@app/shared";
import type { RemoveOutOfGang } from "#/casting/roles/remove-out-of-gang.ts";
import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse, parseJson } from "#/http/json.ts";
import { applyChange } from "./running-order-changes.ts";
import type { RunningOrderStore } from "./running-order-store.ts";

/** Every kind of data kept per item, by name, each able to keep only the items still in the
 *  show: it goes when the item leaves the show (itemCleanupOf in data-stores.ts). */
export type ItemCleanup = Record<
  string,
  { keepOnlyItems(productionId: string, itemIds: string[]): Promise<void> }
>;

// POST /api/productions/{productionId}/running-order/versions: apply one change to the
// latest version and save the result as the next version. An item set to another gang loses
// from its roles anyone not in that gang (junior-cast FR5), whatever the client asked.
export function createSaveRunningOrder(
  store: RunningOrderStore,
  cleanup: ItemCleanup,
  removeOutOfGang: RemoveOutOfGang,
  now = () => new Date(),
): Handler {
  return inProduction(async (productionId, event) => {
    const request = SaveRunningOrderRequest.safeParse(parseJson(event.body));
    if (!request.success) return { statusCode: 400 };

    const latest = await store.latest(productionId);
    if (!latest) return { statusCode: 404 };
    // Someone else saved since this client last looked: send them the latest instead.
    if (request.data.baseVersion !== latest.version) return jsonResponse(409, latest);

    const result = applyChange(latest, request.data.change);
    if (!result.ok) return { statusCode: 400 };

    const next = { ...result.order, version: latest.version + 1, savedAt: now().toISOString() };
    if ((await store.save(next)) === "conflict") {
      const newer = await store.latest(productionId);
      return newer ? jsonResponse(409, newer) : { statusCode: 409 };
    }
    await removeWhatDroppedItemsKept(store, cleanup, productionId, next);
    await removeWhoLeftTheirGang(removeOutOfGang, productionId, itemsChangingGang(latest, next));
    return jsonResponse(201, next);
  });
}

// Only the error's name: a store's message can quote stored casting (ADR 0010).
const nameOf = (error: unknown) => (error instanceof Error ? error.name : "unknown error");

/** After the version is saved, like the clean-up. The version is saved either way, so a
 *  failure is logged rather than reported as a failed save. */
async function removeWhoLeftTheirGang(
  removeOutOfGang: RemoveOutOfGang,
  productionId: string,
  itemIds: string[],
) {
  if (itemIds.length === 0) return;
  try {
    await removeOutOfGang(productionId, (role) => itemIds.includes(role.itemId));
  } catch (error) {
    console.error(
      `Couldn't remove those not in their item's gang in production ${productionId}: ${nameOf(error)}`,
    );
  }
}

/**
 * Nothing about a removed item is kept (ADR 0010). Only after the version is saved, so a
 * refused save deletes nothing. It keeps the items of the newest version, which a later save
 * may have added to, and removes everything else, not just this save's removals: if a kind
 * fails, the others still go and the next save finishes the job. The version is saved either
 * way, so a failure is logged rather than reported to the user as a failed save.
 */
async function removeWhatDroppedItemsKept(
  store: RunningOrderStore,
  cleanup: ItemCleanup,
  productionId: string,
  saved: RunningOrder,
) {
  const couldNot = (what: string, error: unknown) =>
    console.error(
      `Couldn't remove dropped items' ${what} in production ${productionId}: ${nameOf(error)}`,
    );
  let newest: RunningOrder;
  try {
    newest = (await store.latest(productionId)) ?? saved;
  } catch (error) {
    // Not knowing the newest items, keeping only this version's could delete a later save's.
    return couldNot("data", error);
  }
  const itemIds = itemsOf(newest).map((item) => item.id);
  for (const [kind, data] of Object.entries(cleanup)) {
    try {
      await data.keepOnlyItems(productionId, itemIds);
    } catch (error) {
      couldNot(kind, error);
    }
  }
}
