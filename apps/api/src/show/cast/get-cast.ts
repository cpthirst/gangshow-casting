import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import type { CastStore } from "./cast-store.ts";

// GET /api/productions/{productionId}/cast: the production's cast list.
export function createGetCast(store: CastStore): Handler {
  return inProduction(async (productionId) => {
    const list = await store.list(productionId);
    if (!list) return { statusCode: 404 };
    return jsonResponse(200, list);
  });
}
