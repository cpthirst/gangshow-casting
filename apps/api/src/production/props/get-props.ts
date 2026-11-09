import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import type { PropStore } from "./prop-store.ts";

// GET /api/productions/{productionId}/props: every item's props (production-props FR13, FR15).
export function createGetProps(store: PropStore): Handler {
  return inProduction(async (productionId) => {
    return jsonResponse(200, await store.list(productionId));
  });
}
