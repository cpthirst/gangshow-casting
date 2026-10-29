import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { type SceneryFile, SceneryFileName } from "@app/shared";
import { ifExists } from "#/storage/files.ts";
import { localFileLink } from "./local-files.ts";

/**
 * Where each item's scenery files live (ADR 0030). Names come from storage each time, so a
 * file renamed, added or removed there, outside the app, shows on the next list.
 */
export interface SceneryFileStore {
  /** The item's files, in no particular order; none if it has no folder yet. */
  list(productionId: string, itemId: string): Promise<SceneryFile[]>;
  /** A short-lived link that opens or downloads one of the item's files (FR10); undefined if
   *  it isn't there. The name is a valid SceneryFileName. */
  linkTo(productionId: string, itemId: string, name: string): Promise<string | undefined>;
}

/** The item's place in storage: `<production>/<item id>/scenery/` (ADR 0030). The ids are
 *  checked before they get here, so neither can reach another folder. */
export const sceneryFolderOf = (productionId: string, itemId: string) =>
  `${productionId}/${itemId}/scenery/`;

/** A file storage keeps under the item's folder, as a list of zero or one scenery files: none
 *  if its name isn't one a scenery file may have, such as a folder's placeholder. */
export const asSceneryFiles = (name: string, size: number): SceneryFile[] =>
  SceneryFileName.safeParse(name).success ? [{ name, size }] : [];

/** Scenery files in a local folder laid out as the bucket is, for pnpm dev, the demo and tests. */
export function folderSceneryFileStore(folder: string): SceneryFileStore {
  return {
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
    async linkTo(productionId, itemId, name) {
      const folderOfItem = sceneryFolderOf(productionId, itemId);
      const found = await ifExists(() => stat(join(folder, folderOfItem, name)));
      return found?.isFile() ? localFileLink(folderOfItem, name) : undefined;
    },
  };
}
