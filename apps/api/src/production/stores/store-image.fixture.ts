import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type StoreId, storeFolderOf } from "@app/shared";

/** Puts made-up images straight into a store's local folder, as someone could outside the app. */
export async function putStoreImages(folder: string, store: StoreId, ...names: string[]) {
  const place = join(folder, storeFolderOf(store));
  await mkdir(place, { recursive: true });
  for (const name of names) await writeFile(join(place, name), "made-up");
}
