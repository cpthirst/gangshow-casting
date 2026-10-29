import type { AccountRouteKey, RouteKey } from "@app/shared";
import { exportCastingGrid } from "#/casting/casting-grid/export-casting-grid.ts";
import { createAddRole } from "#/casting/roles/add-role.ts";
import { createGetRoles } from "#/casting/roles/get-roles.ts";
import { createRemoveRole } from "#/casting/roles/remove-role.ts";
import { createUpdateRole } from "#/casting/roles/update-role.ts";
import type { Handler } from "#/http/handler.ts";
import { createGetItemNotes } from "#/item-notes/get-item-notes.ts";
import { createSaveItemNote } from "#/item-notes/save-item-note.ts";
import { createAddProp } from "#/production/props/add-prop.ts";
import { createGetProps } from "#/production/props/get-props.ts";
import { createRemoveProp } from "#/production/props/remove-prop.ts";
import { createUpdateProp } from "#/production/props/update-prop.ts";
import { createCountSceneryFiles } from "#/production/scenery/count-scenery-files.ts";
import { createDeleteSceneryFile } from "#/production/scenery/delete-scenery-file.ts";
import { createGetSceneryFileLink } from "#/production/scenery/get-scenery-file-link.ts";
import { createListSceneryFiles } from "#/production/scenery/list-scenery-files.ts";
import type { SceneryFileStore } from "#/production/scenery/scenery-file-store.ts";
import { createAddCastMember } from "#/show/cast/add-cast-member.ts";
import { createDeleteCastMember } from "#/show/cast/delete-cast-member.ts";
import { createGetCast } from "#/show/cast/get-cast.ts";
import { createUpdateCastMember } from "#/show/cast/update-cast-member.ts";
import { createGetRunningOrder } from "#/show/running-order/get-running-order.ts";
import { createSaveRunningOrder } from "#/show/running-order/save-running-order.ts";
import { dataStores, type Stores, sceneryFileStore, usageStore } from "#/storage/data-stores.ts";
import { createUsageRoutes } from "#/usage/usage-routes.ts";
import type { UsageStore } from "#/usage/usage-store.ts";
import { handler as health } from "./health.ts";

/**
 * A handler for each route in the shared route list, which infra hosts one-for-one, but for
 * the account routes: those run in their own function (account-routes.ts, ADR 0017).
 */
export function createRoutes(
  {
    runningOrders,
    cast,
    roles,
    removeCastMember,
    itemNotes,
    props,
    propsNotes,
    sceneryNotes,
  }: Stores,
  usage: UsageStore,
  sceneryFiles: SceneryFileStore,
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
    "DELETE /api/productions/{productionId}/cast/{castId}": createDeleteCastMember(
      removeCastMember,
      roles,
      props,
    ),
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
    "GET /api/productions/{productionId}/items/{itemId}/scenery-files":
      createListSceneryFiles(sceneryFiles),
    "GET /api/productions/{productionId}/items/{itemId}/scenery-file-link":
      createGetSceneryFileLink(sceneryFiles),
    "GET /api/productions/{productionId}/scenery-file-counts":
      createCountSceneryFiles(sceneryFiles),
    "DELETE /api/productions/{productionId}/items/{itemId}/scenery-files":
      createDeleteSceneryFile(sceneryFiles),
    "GET /api/productions/{productionId}/scenery-notes": createGetItemNotes(sceneryNotes),
    "PUT /api/productions/{productionId}/items/{itemId}/scenery-notes": createSaveItemNote(
      sceneryNotes,
      runningOrders,
    ),
    "POST /api/productions/{productionId}/casting-grid/export": exportCastingGrid,
    "POST /api/productions/{productionId}/items/{itemId}/roles": createAddRole(
      roles,
      runningOrders,
      cast,
    ),
    "PUT /api/productions/{productionId}/roles/{roleId}": createUpdateRole(roles, cast, props),
    "DELETE /api/productions/{productionId}/roles/{roleId}": createRemoveRole(roles, props),
    ...createUsageRoutes(usage),
  };
}

const { where, ...stores } = dataStores();
const sceneryFiles = sceneryFileStore();
/** Where the data is kept, for the dev server to say on start. */
export const dataLocation = `${where}; ${sceneryFiles.where}`;

/** The local scenery files' folder, which the dev server serves; undefined with a bucket. */
export const localFilesFolder = sceneryFiles.folder;

/** The routes on the data the environment names (data-stores.ts). */
export const routes = createRoutes(stores, usageStore(), sceneryFiles.store);
