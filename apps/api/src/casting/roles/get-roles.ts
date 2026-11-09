import { type Handler, inProduction } from "#/http/handler.ts";
import { jsonResponse } from "#/http/json.ts";
import type { RoleStore } from "./role-store.ts";

// GET /api/productions/{productionId}/roles: every role in the production.
export function createGetRoles(store: RoleStore): Handler {
  return inProduction(async (productionId) => {
    return jsonResponse(200, await store.list(productionId));
  });
}
