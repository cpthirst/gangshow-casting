import { inMemoryRoleStore } from "#/casting/roles/role-store.ts";
import { inMemoryItemNoteStore } from "#/item-notes/item-note-store.ts";
import type { ItemFileStore, ItemFileStores } from "#/production/item-files/item-file-store.ts";
import { inMemoryMicPlotStore } from "#/production/mic-plot/mic-plot-store.ts";
import { inMemoryPropStore } from "#/production/props/prop-store.ts";
import { inMemoryProductionListStore } from "#/production-list/production-list-store.ts";
import { inMemoryCastStore } from "#/show/cast/cast-store.ts";
import { uncastThenRemove } from "#/show/cast/remove-cast-member.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import type { Stores } from "./data-stores.ts";

/** Every store, in memory and empty, but for those a test gives. */
export function inMemoryStores(given: Partial<Stores> = {}): Stores {
  const cast = given.cast ?? inMemoryCastStore();
  const roles = given.roles ?? inMemoryRoleStore();
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
    removeCastMember: uncastThenRemove(cast, roles),
    ...given,
    cast,
    roles,
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
