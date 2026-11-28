import { inMemoryRoleStore } from "#/casting/roles/role-store.ts";
import { inMemoryItemNoteStore } from "#/item-notes/item-note-store.ts";
import { inMemoryCostumeStore } from "#/production/costumes/costume-store.ts";
import type { ItemFileStore, ItemFileStores } from "#/production/item-files/item-file-store.ts";
import { inMemoryMicPlotStore } from "#/production/mic-plot/mic-plot-store.ts";
import { inMemoryPropStore } from "#/production/props/prop-store.ts";
import type { StoreImageStore } from "#/production/stores/store-image-store.ts";
import { inMemoryProductionListStore } from "#/production-list/production-list-store.ts";
import { createRoutes } from "#/routes.ts";
import { inMemoryCastStore } from "#/show/cast/cast-store.ts";
import { uncastThenRemove } from "#/show/cast/remove-cast-member.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { inMemoryUsageStore } from "#/usage/usage-store.ts";
import type { Stores } from "./data-stores.ts";

/** Every store, in memory and empty, but for those a test gives. */
export function inMemoryStores(given: Partial<Stores> = {}): Stores {
  const cast = given.cast ?? inMemoryCastStore();
  const roles = given.roles ?? inMemoryRoleStore();
  const costumes = given.costumes ?? inMemoryCostumeStore();
  return {
    runningOrders: inMemoryRunningOrderStore(),
    itemNotes: inMemoryItemNoteStore(),
    props: inMemoryPropStore(),
    propsNotes: inMemoryItemNoteStore(),
    sceneryNotes: inMemoryItemNoteStore(),
    sfxNotes: inMemoryItemNoteStore(),
    wardrobeNotes: inMemoryItemNoteStore(),
    micPlots: inMemoryMicPlotStore(),
    micPlotNotes: inMemoryItemNoteStore(),
    productions: inMemoryProductionListStore(),
    removeCastMember: uncastThenRemove(cast, roles, costumes),
    ...given,
    cast,
    roles,
    costumes,
  };
}

/** A department's file store holding nothing. */
export const noFiles: ItemFileStore = {
  list: async () => [],
  linkTo: async () => undefined,
  remove: async () => "gone",
  uploadTo: async () => "taken",
  countByItem: async () => ({}),
  keepOnlyItems: async () => {},
};

/** Every department's file store, holding nothing. */
export const noItemFiles: ItemFileStores = { scenery: noFiles, sfx: noFiles, wardrobe: noFiles };

/** The stores, holding no images. */
export const noStoreImages: StoreImageStore = {
  list: async () => [],
  linkTo: async () => undefined,
  uploadTo: async () => {
    throw new Error("not used here");
  },
  remove: async () => "gone",
};

/** The routes on the stores given, recording usage in memory and holding no files. */
export const routesOn = (stores: Stores) =>
  createRoutes(stores, inMemoryUsageStore(), noItemFiles, noStoreImages);
