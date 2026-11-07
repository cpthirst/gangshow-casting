import type { AccountRouteKey, RouteKey } from "@app/shared";
import { exportCastingGrid } from "#/casting/casting-grid/export-casting-grid.ts";
import { createAddRole } from "#/casting/roles/add-role.ts";
import { createGetRoles } from "#/casting/roles/get-roles.ts";
import { createRemoveRole } from "#/casting/roles/remove-role.ts";
import { createUpdateRole } from "#/casting/roles/update-role.ts";
import type { Handler } from "#/http/handler.ts";
import { createGetItemNotes } from "#/item-notes/get-item-notes.ts";
import { createSaveItemNote } from "#/item-notes/save-item-note.ts";
import { createCountItemFiles } from "#/production/item-files/count-item-files.ts";
import { createDeleteItemFile } from "#/production/item-files/delete-item-file.ts";
import { createGetItemFileLink } from "#/production/item-files/get-item-file-link.ts";
import type { ItemFileStores } from "#/production/item-files/item-file-store.ts";
import { createListItemFiles } from "#/production/item-files/list-item-files.ts";
import { createUploadItemFile } from "#/production/item-files/upload-item-file.ts";
import { createAllocateMic } from "#/production/mic-plot/allocate-mic.ts";
import { createGetMicPlot } from "#/production/mic-plot/get-mic-plot.ts";
import { createAddProp } from "#/production/props/add-prop.ts";
import { createGetProps } from "#/production/props/get-props.ts";
import { createRemoveProp } from "#/production/props/remove-prop.ts";
import { createUpdateProp } from "#/production/props/update-prop.ts";
import { createAddCastMember } from "#/show/cast/add-cast-member.ts";
import { createDeleteCastMember } from "#/show/cast/delete-cast-member.ts";
import { createGetCast } from "#/show/cast/get-cast.ts";
import { createUpdateCastMember } from "#/show/cast/update-cast-member.ts";
import { createGetRunningOrder } from "#/show/running-order/get-running-order.ts";
import { createSaveRunningOrder } from "#/show/running-order/save-running-order.ts";
import { dataStores, itemFileStores, type Stores, usageStore } from "#/storage/data-stores.ts";
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
    sfxNotes,
    wardrobeNotes,
    micPlots,
    micPlotNotes,
  }: Stores,
  usage: UsageStore,
  files: ItemFileStores,
): Record<Exclude<RouteKey, AccountRouteKey>, Handler> {
  const { scenery: sceneryFiles, sfx: sfxFiles, wardrobe: wardrobeFiles } = files;
  return {
    "GET /api/health": health,
    "GET /api/productions/{productionId}/running-order": createGetRunningOrder(runningOrders),
    "POST /api/productions/{productionId}/running-order/versions": createSaveRunningOrder(
      runningOrders,
      {
        roles,
        itemNotes,
        sceneryFiles,
        sceneryNotes,
        props,
        propsNotes,
        sfxFiles,
        sfxNotes,
        wardrobeFiles,
        wardrobeNotes,
        micPlots,
        micPlotNotes,
      },
    ),
    "GET /api/productions/{productionId}/cast": createGetCast(cast),
    "POST /api/productions/{productionId}/cast": createAddCastMember(cast),
    "PUT /api/productions/{productionId}/cast/{castId}": createUpdateCastMember(cast),
    "DELETE /api/productions/{productionId}/cast/{castId}": createDeleteCastMember(
      removeCastMember,
      roles,
      { props, micPlots },
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
      createListItemFiles(sceneryFiles),
    "GET /api/productions/{productionId}/items/{itemId}/scenery-file-link":
      createGetItemFileLink(sceneryFiles),
    "GET /api/productions/{productionId}/scenery-file-counts": createCountItemFiles(sceneryFiles),
    "DELETE /api/productions/{productionId}/items/{itemId}/scenery-files":
      createDeleteItemFile(sceneryFiles),
    "POST /api/productions/{productionId}/items/{itemId}/scenery-uploads": createUploadItemFile(
      sceneryFiles,
      runningOrders,
    ),
    "GET /api/productions/{productionId}/scenery-notes": createGetItemNotes(sceneryNotes),
    "PUT /api/productions/{productionId}/items/{itemId}/scenery-notes": createSaveItemNote(
      sceneryNotes,
      runningOrders,
    ),
    "GET /api/productions/{productionId}/items/{itemId}/sfx-files": createListItemFiles(sfxFiles),
    "GET /api/productions/{productionId}/items/{itemId}/sfx-file-link":
      createGetItemFileLink(sfxFiles),
    "DELETE /api/productions/{productionId}/items/{itemId}/sfx-files":
      createDeleteItemFile(sfxFiles),
    "POST /api/productions/{productionId}/items/{itemId}/sfx-uploads": createUploadItemFile(
      sfxFiles,
      runningOrders,
    ),
    "GET /api/productions/{productionId}/sfx-file-counts": createCountItemFiles(sfxFiles),
    "GET /api/productions/{productionId}/sfx-notes": createGetItemNotes(sfxNotes),
    "PUT /api/productions/{productionId}/items/{itemId}/sfx-notes": createSaveItemNote(
      sfxNotes,
      runningOrders,
    ),
    "GET /api/productions/{productionId}/items/{itemId}/wardrobe-files":
      createListItemFiles(wardrobeFiles),
    "GET /api/productions/{productionId}/items/{itemId}/wardrobe-file-link":
      createGetItemFileLink(wardrobeFiles),
    "DELETE /api/productions/{productionId}/items/{itemId}/wardrobe-files":
      createDeleteItemFile(wardrobeFiles),
    "POST /api/productions/{productionId}/items/{itemId}/wardrobe-uploads": createUploadItemFile(
      wardrobeFiles,
      runningOrders,
    ),
    "GET /api/productions/{productionId}/wardrobe-file-counts": createCountItemFiles(wardrobeFiles),
    "GET /api/productions/{productionId}/wardrobe-notes": createGetItemNotes(wardrobeNotes),
    "PUT /api/productions/{productionId}/items/{itemId}/wardrobe-notes": createSaveItemNote(
      wardrobeNotes,
      runningOrders,
    ),
    "GET /api/productions/{productionId}/mic-plot": createGetMicPlot(micPlots),
    "PUT /api/productions/{productionId}/items/{itemId}/mic-plot": createAllocateMic(
      micPlots,
      runningOrders,
      roles,
    ),
    "GET /api/productions/{productionId}/mic-plot-notes": createGetItemNotes(micPlotNotes),
    "PUT /api/productions/{productionId}/items/{itemId}/mic-plot-notes": createSaveItemNote(
      micPlotNotes,
      runningOrders,
    ),
    "POST /api/productions/{productionId}/casting-grid/export": exportCastingGrid,
    "POST /api/productions/{productionId}/items/{itemId}/roles": createAddRole(
      roles,
      runningOrders,
      cast,
    ),
    "PUT /api/productions/{productionId}/roles/{roleId}": createUpdateRole(roles, cast, {
      props,
      micPlots,
    }),
    "DELETE /api/productions/{productionId}/roles/{roleId}": createRemoveRole(roles, {
      props,
      micPlots,
    }),
    ...createUsageRoutes(usage),
  };
}

const { where, ...stores } = dataStores();
const files = itemFileStores();
/** Where the data is kept, for the dev server to say on start. */
export const dataLocation = `${where}; ${files.where}`;

/** The local item files' folder, which the dev server serves; undefined with a bucket. */
export const localFilesFolder = files.folder;

/** The routes on the data the environment names (data-stores.ts). */
export const routes = createRoutes(stores, usageStore(), files.stores);
