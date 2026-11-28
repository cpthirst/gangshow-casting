import { stat } from "node:fs/promises";
import { join } from "node:path";
import {
  fileDepartments,
  ItemFileName,
  ProductionId,
  STORES_FOLDER,
  storeFolderOf,
  storeOf,
} from "@app/shared";
import { folderIdOf } from "#/http/params.ts";
import { ifExists } from "#/storage/files.ts";
import { fileHeadersOf, type LinkOptions } from "./file-headers.ts";

/** Where the dev server serves the local item files, standing in for the bucket's links. */
export const LOCAL_FILES_PATH = "/api/local-files/";

/** The dev server's link to a local item file: its key, under LOCAL_FILES_PATH, asking for a
 *  download as the bucket's link would. */
export const localFileLink = (folder: string, name: string, { download }: LinkOptions = {}) =>
  `${LOCAL_FILES_PATH}${folder}${encodeURIComponent(name)}${download ? "?download=true" : ""}`;

const decoded = (part: string) => {
  try {
    return decodeURIComponent(part);
  } catch {
    return undefined;
  }
};

/**
 * Where in the folder a LOCAL_FILES_PATH path's item file is, as the folder store lays it out,
 * and its name; undefined unless it names one. Each part is checked as a key's would be, so no
 * path can reach outside an item's scenery, SFX or Wardrobe folder, or a store's (ADR 0030,
 * ADR 0032, ADR 0043).
 */
export function localFilePlace(folder: string, path: string) {
  if (!path.startsWith(LOCAL_FILES_PATH)) return undefined;
  const parts = path.slice(LOCAL_FILES_PATH.length).split("/").map(decoded);
  return parts[0] === STORES_FOLDER ? storeFilePlace(folder, parts) : itemFilePlace(folder, parts);
}

// A store's image, at stores/<store>/<name>, outside every production's folder (ADR 0043).
function storeFilePlace(folder: string, [, storeId, name, ...rest]: (string | undefined)[]) {
  const store = storeOf(storeId);
  const fileName = ItemFileName.safeParse(name);
  if (rest.length > 0 || store === undefined || !fileName.success) return undefined;
  return {
    file: join(folder, storeFolderOf(store), fileName.data),
    name: fileName.data,
    department: store,
  };
}

function itemFilePlace(
  folder: string,
  [productionId, itemId, department, name, ...rest]: (string | undefined)[],
) {
  const production = ProductionId.safeParse(productionId);
  const item = folderIdOf(itemId);
  const fileName = ItemFileName.safeParse(name);
  const fileDepartment = fileDepartments.find((known) => known === department);
  if (
    rest.length > 0 ||
    fileDepartment === undefined ||
    !production.success ||
    item === undefined ||
    !fileName.success
  ) {
    return undefined;
  }
  return {
    file: join(folder, production.data, item, fileDepartment, fileName.data),
    name: fileName.data,
    department: fileDepartment,
  };
}

/** The local item file a LOCAL_FILES_PATH path names, with the headers to send it with;
 *  undefined unless it names one that's there. */
export async function localFileAt(folder: string, path: string, options?: LinkOptions) {
  const place = localFilePlace(folder, path);
  if (!place) return undefined;
  const { file, name, department } = place;
  const found = await ifExists(() => stat(file));
  if (!found?.isFile()) return undefined;
  const { contentType, contentDisposition } = fileHeadersOf(name, department, options);
  return {
    file,
    headers: {
      "content-type": contentType,
      "content-disposition": contentDisposition,
      "content-length": String(found.size),
      // On the app's own address, unlike the bucket's links, so nothing it sends may run:
      // the browser mustn't guess another type, and a download has no rights at all.
      "x-content-type-options": "nosniff",
      ...(contentDisposition.startsWith("attachment")
        ? { "content-security-policy": "sandbox" }
        : {}),
    },
  };
}
