import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { type FileDepartment, type ItemFile, ItemFileName, type ItemFileUpload } from "@app/shared";
import { folderIdOf } from "#/http/params.ts";
import { ifExists } from "#/storage/files.ts";
import { localFileLink } from "./local-files.ts";

/**
 * Where each item's files live for one department, Scenery's, SFX's or Wardrobe's (ADR 0030, ADR 0032).
 * Names come from storage each time, so a file renamed, added or removed there, outside the
 * app, shows on the next list. A store never reaches another department's files.
 */
export interface ItemFileStore {
  /** The item's files, in no particular order; none if it has no folder yet. */
  list(productionId: string, itemId: string): Promise<ItemFile[]>;
  /** How many files each item in the production has, by item id, from one look at storage
   *  (production-overview FR14); an item with none is left out. */
  countByItem(productionId: string): Promise<Record<string, number>>;
  /** A short-lived link that opens or downloads one of the item's files (FR10); undefined if
   *  it isn't there. The name is a valid ItemFileName. */
  linkTo(productionId: string, itemId: string, name: string): Promise<string | undefined>;
  /** Deletes one of the item's files for good (FR11), or says it was already gone. The name is
   *  a valid ItemFileName. */
  remove(productionId: string, itemId: string, name: string): Promise<"removed" | "gone">;
  /** Where the browser may send one file of the item's, of up to 100 MB, for a few minutes
   *  (FR8); "taken" if the item has a file of that name and it isn't to be replaced (FR9). The
   *  name is a valid ItemFileName. */
  uploadTo(
    productionId: string,
    itemId: string,
    name: string,
    options: { replace: boolean },
  ): Promise<ItemFileUpload | "taken">;
  /** Deletes every one of the department's files of the production's items not listed, for
   *  good, leaving other departments' files alone (FR13). It goes by storage, not the running
   *  order, so a file put in a removed item's folder later goes too. */
  keepOnlyItems(productionId: string, itemIds: string[]): Promise<void>;
}

/** Each department's files, kept apart (ADR 0032). */
export type ItemFileStores = Record<FileDepartment, ItemFileStore>;

/** The item's place in storage for the department: `<production>/<item id>/<department>/`
 *  (ADR 0030). The ids are checked before they get here, so neither can reach another folder. */
export const itemFolderOf = (productionId: string, itemId: string, department: FileDepartment) =>
  `${productionId}/${itemId}/${department}/`;

/** Counts, by item id, of the department's files at the keys given, each
 *  `<item id>/<department>/<name>` under the production's folder. Anything else, such as a
 *  nested file or another department's, is left out. */
export function countsByItem(keys: Iterable<string>, department: FileDepartment) {
  const counts: Record<string, number> = {};
  for (const key of keys) {
    const [item, keyDepartment, name, ...rest] = key.split("/");
    const itemId = folderIdOf(item);
    if (itemId === undefined || keyDepartment !== department || rest.length > 0) continue;
    if (!ItemFileName.safeParse(name).success) continue;
    counts[itemId] = (counts[itemId] ?? 0) + 1;
  }
  return counts;
}

/** Whether the key, `<item id>/<department>/…` under the production's folder, is one of the
 *  department's files or folders of an item not kept. */
export function isDroppedFile(key: string, kept: ReadonlySet<string>, department: FileDepartment) {
  const [item, keyDepartment, ...rest] = key.split("/");
  const itemId = folderIdOf(item);
  return (
    itemId !== undefined && !kept.has(itemId) && keyDepartment === department && rest.length > 0
  );
}

/** A file storage keeps under the item's folder, as a list of zero or one files: none if its
 *  name isn't one a file may have, such as a folder's placeholder. */
export const asItemFiles = (name: string, size: number): ItemFile[] =>
  ItemFileName.safeParse(name).success ? [{ name, size }] : [];

/** The department's files in a local folder laid out as the bucket is, for pnpm dev, the demo
 *  and tests. */
export function folderItemFileStore(folder: string, department: FileDepartment): ItemFileStore {
  const folderOf = (productionId: string, itemId: string) =>
    itemFolderOf(productionId, itemId, department);
  const store: ItemFileStore = {
    async list(productionId, itemId) {
      const place = join(folder, folderOf(productionId, itemId));
      const entries = (await ifExists(() => readdir(place, { withFileTypes: true }))) ?? [];
      const files = entries.filter((entry) => entry.isFile());
      const sized = await Promise.all(
        files.map(async ({ name }) => {
          // Gone since the folder was read, if removed or renamed outside the app meanwhile.
          const found = await ifExists(() => stat(join(place, name)));
          return found ? asItemFiles(name, found.size) : [];
        }),
      );
      return sized.flat();
    },
    async countByItem(productionId) {
      const items =
        (await ifExists(() => readdir(join(folder, productionId), { withFileTypes: true }))) ?? [];
      const listed = await Promise.all(
        items
          .filter((item) => item.isDirectory())
          .map(async ({ name: item }) =>
            folderIdOf(item) === undefined
              ? []
              : (await store.list(productionId, item)).map(
                  ({ name }) => `${item}/${department}/${name}`,
                ),
          ),
      );
      return countsByItem(listed.flat(), department);
    },
    async linkTo(productionId, itemId, name) {
      const folderOfItem = folderOf(productionId, itemId);
      const found = await ifExists(() => stat(join(folder, folderOfItem, name)));
      return found?.isFile() ? localFileLink(folderOfItem, name) : undefined;
    },
    async remove(productionId, itemId, name) {
      const file = join(folder, folderOf(productionId, itemId), name);
      const found = await ifExists(() => stat(file));
      if (!found?.isFile()) return "gone";
      // Gone meanwhile, if deleted in another browser at the same moment: removed all the same.
      await rm(file, { force: true });
      return "removed";
    },
    async uploadTo(productionId, itemId, name, { replace }) {
      // Exactly, as the bucket compares keys, though a Mac's or Windows' folder ignores case.
      const taken = (await store.list(productionId, itemId)).some((file) => file.name === name);
      if (taken && !replace) return "taken";
      // The dev server takes the file here, as the bucket would (dev-server.ts).
      return { url: localFileLink(folderOf(productionId, itemId), name), fields: {} };
    },
    async keepOnlyItems(productionId, itemIds) {
      const kept = new Set(itemIds);
      const items =
        (await ifExists(() => readdir(join(folder, productionId), { withFileTypes: true }))) ?? [];
      for (const item of items) {
        if (!item.isDirectory() || !isDroppedFile(`${item.name}/${department}/`, kept, department))
          continue;
        await rm(join(folder, folderOf(productionId, item.name)), {
          recursive: true,
          force: true,
        });
      }
    },
  };
  return store;
}
