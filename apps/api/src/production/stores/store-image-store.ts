import { type ItemFile, type StoreId, storeFolderOf } from "@app/shared";
import type { LinkOptions } from "#/production/item-files/file-headers.ts";
import { localFilesIn, localLinkTo } from "#/production/item-files/item-file-store.ts";

/**
 * Where the show's stores keep their images, outside every production (ADR 0043). Names come
 * from storage each time, as item files' do, so one added or removed there shows on the next
 * list. A store never reaches another's images, nor any production's files.
 */
export interface StoreImageStore {
  /** The store's files, in no particular order; none if it has no folder yet. */
  list(store: StoreId): Promise<ItemFile[]>;
  /** A short-lived link that opens or downloads one of the store's files; undefined if it
   *  isn't there. The name is a valid ItemFileName. */
  linkTo(store: StoreId, name: string, options?: LinkOptions): Promise<string | undefined>;
}

/** The stores' images in a local folder laid out as the bucket is, for pnpm dev, the demo and
 *  tests. */
export const folderStoreImageStore = (folder: string): StoreImageStore => ({
  list: (store) => localFilesIn(folder, storeFolderOf(store)),
  linkTo: (store, name, options) => localLinkTo(folder, storeFolderOf(store), name, options),
});
