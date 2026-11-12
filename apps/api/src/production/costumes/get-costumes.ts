import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import type { CostumeStore } from "./costume-store.ts";

// GET /api/productions/{productionId}/costumes: what everyone wears in every item
// (production-costume-sheets FR4), for anyone signed in.
export function createGetCostumes(store: CostumeStore): Handler {
  return inProduction(async (productionId) => jsonResponse(200, await store.list(productionId)));
}
