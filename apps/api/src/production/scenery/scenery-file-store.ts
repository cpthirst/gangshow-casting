import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { type SceneryFile, SceneryFileName } from "@app/shared";
import { folderIdOf } from "#/http/params.ts";
import { ifExists } from "#/storage/files.ts";
import { localFileLink } from "./local-files.ts";

/**
 * Where each item's scenery files live (ADR 0030). Names come from storage each time, so a
 * file renamed, added or removed there, outside the app, shows on the next list.
 */
export interface SceneryFileStore {
  /** The item's files, in no particular order; none if it has no folder yet. */
  list(productionId: string, itemId: string): Promise<SceneryFile[]>;
  /** How many files each item in the production has, by item id, from one look at storage
   *  (production-overview FR14); an item with none is left out. */
  countByItem(productionId: string): Promise<Record<string, number>>;
  /** A short-lived link that opens or downloads one of the item's files (FR10); undefined if
   *  it isn't there. The name is a valid SceneryFileName. */
  linkTo(productionId: string, itemId: string, name: string): Promise<string | undefined>;
  /** Deletes one of the item's files for good (FR11), or says it was already gone. The name is
   *  a valid SceneryFileName. */
  remove(productionId: string, itemId: string, name: string): Promise<"removed" | "gone">;
}

/** The item's place in storage: `<production>/<item id>/scenery/` (ADR 0030). The ids are
 *  checked before they get here, so neither can reach another folder. */
export const sceneryFolderOf = (productionId: string, itemId: string) =>
  `${productionId}/${itemId}/scenery/`;

/** Counts, by item id, of the files at the keys given, each `<item id>/scenery/<name>` under
 *  the production's folder. Anything else, such as a nested file, is left out. */
export function countsByItem(keys: Iterable<string>) {
  const counts: Record<string, number> = {};
  for (const key of keys) {
    const [item, department, name, ...rest] = key.split("/");
    const itemId = folderIdOf(item);
    if (itemId === undefined || department !== "scenery" || rest.length > 0) continue;
    if (!SceneryFileName.safeParse(name).success) continue;
    counts[itemId] = (counts[itemId] ?? 0) + 1;
  }
  return counts;
}

/** A file storage keeps under the item's folder, as a list of zero or one scenery files: none
 *  if its name isn't one a scenery file may have, such as a folder's placeholder. */
export const asSceneryFiles = (name: string, size: number): SceneryFile[] =>
  SceneryFileName.safeParse(name).success ? [{ name, size }] : [];

/** Scenery files in a local folder laid out as the bucket is, for pnpm dev, the demo and tests. */
export function folderSceneryFileStore(folder: string): SceneryFileStore {
  const store: SceneryFileStore = {
    async list(productionId, itemId) {
      const place = join(folder, sceneryFolderOf(productionId, itemId));
      const entries = (await ifExists(() => readdir(place, { withFileTypes: true }))) ?? [];
      const files = entries.filter((entry) => entry.isFile());
      const sized = await Promise.all(
        files.map(async ({ name }) => {
          // Gone since the folder was read, if removed or renamed outside the app meanwhile.
          const found = await ifExists(() => stat(join(place, name)));
          return found ? asSceneryFiles(name, found.size) : [];
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
              : (await store.list(productionId, item)).map(({ name }) => `${item}/scenery/${name}`),
          ),
      );
      return countsByItem(listed.flat());
    },
    async linkTo(productionId, itemId, name) {
      const folderOfItem = sceneryFolderOf(productionId, itemId);
      const found = await ifExists(() => stat(join(folder, folderOfItem, name)));
      return found?.isFile() ? localFileLink(folderOfItem, name) : undefined;
    },
    async remove(productionId, itemId, name) {
      const file = join(folder, sceneryFolderOf(productionId, itemId), name);
      const found = await ifExists(() => stat(file));
      if (!found?.isFile()) return "gone";
      // Gone meanwhile, if deleted in another browser at the same moment: removed all the same.
      await rm(file, { force: true });
      return "removed";
    },
  };
  return store;
}
