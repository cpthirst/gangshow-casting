import { createAddCastMember } from "./add-cast-member.ts";
import { createAddRole } from "./add-role.ts";
import { dataStores } from "./data-stores.ts";
import { createDeleteCastMember } from "./delete-cast-member.ts";
import { createGetCast } from "./get-cast.ts";
import { createGetItemNotes } from "./get-item-notes.ts";
import { createGetRoles } from "./get-roles.ts";
import { createGetRunningOrder } from "./get-running-order.ts";
import type { Handler } from "./handler.ts";
import { handler as health } from "./health.ts";
import { createRemoveRole } from "./remove-role.ts";
import { createSaveItemNote } from "./save-item-note.ts";
import { createSaveRunningOrder } from "./save-running-order.ts";
import { createUpdateCastMember } from "./update-cast-member.ts";
import { createUpdateRole } from "./update-role.ts";

const { runningOrders, cast, roles, removeCastMember, itemNotes, where } = dataStores();
/** Where the data is kept, for the dev server to say on start. */
export const dataLocation = where;

/** One entry per future API Gateway route: "<METHOD> <path>", with {name} path parameters. */
export const routes: Record<string, Handler> = {
  "GET /api/health": health,
  "GET /api/productions/{productionId}/running-order": createGetRunningOrder(runningOrders),
  "POST /api/productions/{productionId}/running-order/versions":
    createSaveRunningOrder(runningOrders),
  "GET /api/productions/{productionId}/cast": createGetCast(cast),
  "POST /api/productions/{productionId}/cast": createAddCastMember(cast),
  "PUT /api/productions/{productionId}/cast/{castId}": createUpdateCastMember(cast),
  "DELETE /api/productions/{productionId}/cast/{castId}": createDeleteCastMember(removeCastMember),
  "GET /api/productions/{productionId}/roles": createGetRoles(roles),
  "GET /api/productions/{productionId}/item-notes": createGetItemNotes(itemNotes),
  "PUT /api/productions/{productionId}/items/{itemId}/notes": createSaveItemNote(
    itemNotes,
    runningOrders,
  ),
  "POST /api/productions/{productionId}/items/{itemId}/roles": createAddRole(
    roles,
    runningOrders,
    cast,
  ),
  "PUT /api/productions/{productionId}/roles/{roleId}": createUpdateRole(roles, cast),
  "DELETE /api/productions/{productionId}/roles/{roleId}": createRemoveRole(roles),
};
