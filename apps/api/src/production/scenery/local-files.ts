import { stat } from "node:fs/promises";
import { join } from "node:path";
import { ProductionId, SceneryFileName } from "@app/shared";
import { folderIdOf } from "#/http/params.ts";
import { ifExists } from "#/storage/files.ts";
import { fileHeadersOf } from "./file-headers.ts";

/** Where the dev server serves the local scenery files, standing in for the bucket's links. */
export const LOCAL_FILES_PATH = "/api/local-files/";

/** The dev server's link to a local scenery file: its key, under LOCAL_FILES_PATH. */
export const localFileLink = (folder: string, name: string) =>
  `${LOCAL_FILES_PATH}${folder}${encodeURIComponent(name)}`;

const decoded = (part: string) => {
  try {
    return decodeURIComponent(part);
  } catch {
    return undefined;
  }
};

/**
 * Where in the folder a LOCAL_FILES_PATH path's scenery file is, as the folder store lays it
 * out, and its name; undefined unless it names one. Each part is checked as a key's would be,
 * so no path can reach outside an item's scenery folder (ADR 0030).
 */
export function localFilePlace(folder: string, path: string) {
  if (!path.startsWith(LOCAL_FILES_PATH)) return undefined;
  const [productionId, itemId, department, name, ...rest] = path
    .slice(LOCAL_FILES_PATH.length)
    .split("/")
    .map(decoded);
  const production = ProductionId.safeParse(productionId);
  const item = folderIdOf(itemId);
  const fileName = SceneryFileName.safeParse(name);
  if (
    rest.length > 0 ||
    department !== "scenery" ||
    !production.success ||
    item === undefined ||
    !fileName.success
  ) {
    return undefined;
  }
  return {
    file: join(folder, production.data, item, department, fileName.data),
    name: fileName.data,
  };
}

/** The local scenery file a LOCAL_FILES_PATH path names, with the headers to send it with;
 *  undefined unless it names one that's there. */
export async function localFileAt(folder: string, path: string) {
  const place = localFilePlace(folder, path);
  if (!place) return undefined;
  const { file, name } = place;
  const found = await ifExists(() => stat(file));
  if (!found?.isFile()) return undefined;
  const { contentType, contentDisposition } = fileHeadersOf(name);
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
