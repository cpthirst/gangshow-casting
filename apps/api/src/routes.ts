import type { AccountRouteKey, RouteKey } from "@app/shared";
import { createAddCastMember } from "./add-cast-member.ts";
import { createAddProp } from "./add-prop.ts";
import { createAddRole } from "./add-role.ts";
import { dataStores, type Stores, usageStore } from "./data-stores.ts";
import { createDeleteCastMember } from "./delete-cast-member.ts";
import { exportCastingGrid } from "./export-casting-grid.ts";
import { createGetCast } from "./get-cast.ts";
import { createGetItemNotes } from "./get-item-notes.ts";
import { createGetProps } from "./get-props.ts";
import { createGetRoles } from "./get-roles.ts";
import { createGetRunningOrder } from "./get-running-order.ts";
import type { Handler } from "./handler.ts";
import { handler as health } from "./health.ts";
import { createRemoveProp } from "./remove-prop.ts";
import { createRemoveRole } from "./remove-role.ts";
import { createSaveItemNote } from "./save-item-note.ts";
import { createSaveRunningOrder } from "./save-running-order.ts";
import { createUpdateCastMember } from "./update-cast-member.ts";
import { createUpdateProp } from "./update-prop.ts";
import { createUpdateRole } from "./update-role.ts";
import { createUsageRoutes } from "./usage-routes.ts";
import type { UsageStore } from "./usage-store.ts";

/**
 * A handler for each route in the shared route list, which infra hosts one-for-one, but for
 * the account routes: those run in their own function (account-routes.ts, ADR 0017).
 */
export function createRoutes(
  { runningOrders, cast, roles, removeCastMember, itemNotes, props, propsNotes }: Stores,
  usage: UsageStore,
): Record<Exclude<RouteKey, AccountRouteKey>, Handler> {
  return {
    "GET /api/health": health,
    "GET /api/productions/{productionId}/running-order": createGetRunningOrder(runningOrders),
    "POST /api/productions/{productionId}/running-order/versions": createSaveRunningOrder(
      runningOrders,
      { roles, itemNotes },
    ),
    "GET /api/productions/{productionId}/cast": createGetCast(cast),
    "POST /api/productions/{productionId}/cast": createAddCastMember(cast),
    "PUT /api/productions/{productionId}/cast/{castId}": createUpdateCastMember(cast),
    "DELETE /api/productions/{productionId}/cast/{castId}":
      createDeleteCastMember(removeCastMember),
    "GET /api/productions/{productionId}/roles": createGetRoles(roles),
    "GET /api/productions/{productionId}/item-notes": createGetItemNotes(itemNotes),
    "PUT /api/productions/{productionId}/items/{itemId}/notes": createSaveItemNote(
      itemNotes,
      runningOrders,
    ),
    "GET /api/productions/{productionId}/props": createGetProps(props),
    "POST /api/productions/{productionId}/items/{itemId}/props": createAddProp(
      props,
      runningOrders,
      roles,
    ),
    "PUT /api/productions/{productionId}/props/{propId}": createUpdateProp(props, roles),
    "DELETE /api/productions/{productionId}/props/{propId}": createRemoveProp(props),
    "GET /api/productions/{productionId}/props-notes": createGetItemNotes(propsNotes),
    "PUT /api/productions/{productionId}/items/{itemId}/props-notes": createSaveItemNote(
      propsNotes,
      runningOrders,
    ),
    "POST /api/productions/{productionId}/casting-grid/export": exportCastingGrid,
    "POST /api/productions/{productionId}/items/{itemId}/roles": createAddRole(
      roles,
      runningOrders,
      cast,
    ),
    "PUT /api/productions/{productionId}/roles/{roleId}": createUpdateRole(roles, cast),
    "DELETE /api/productions/{productionId}/roles/{roleId}": createRemoveRole(roles),
    ...createUsageRoutes(usage),
  };
}

const { where, ...stores } = dataStores();
/** Where the data is kept, for the dev server to say on start. */
export const dataLocation = where;

/** The routes on the data the environment names (data-stores.ts). */
export const routes = createRoutes(stores, usageStore());
