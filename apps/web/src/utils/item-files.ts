import type { FileDepartment } from "@app/shared";
import { PRODUCTION_PATH } from "./production.ts";

// Each item's files for a Production department, Scenery's, SFX's or Wardrobe's,
// which share one page layout (production-sfx-wardrobe FR2) and the API's routes, each named
// after it.

/** A department whose item page keeps the item's files and notes; its name and route come
 *  from the shared list. */
export interface FilesDepartment {
  /** Its word in the API's routes: …/items/{itemId}/<key>-files, …/<key>-notes. */
  key: FileDepartment;
  /** What the upload area says the files must be, if anything. */
  uploadRule?: string;
}

export const sceneryDepartment: FilesDepartment = {
  key: "scenery",
  uploadRule: "Scenery and set images only: no photos of cast members.",
};

export const sfxDepartment: FilesDepartment = { key: "sfx" };

// Its rule stands in for checking each file, as Scenery's does (production-sfx-wardrobe FR4,
// ADR 0010).
export const wardrobeDepartment: FilesDepartment = {
  key: "wardrobe",
  uploadRule: "Costume designs and images only: no photos of cast members.",
};

const itemPath = (itemId: string) => `${PRODUCTION_PATH}/items/${encodeURIComponent(itemId)}`;

/** The item's files, as file storage holds them now. */
export const itemFilesPath = (department: FileDepartment, itemId: string) =>
  `${itemPath(itemId)}/${department}-files`;

/** One of the item's files, to delete it. */
export const itemFilePath = (department: FileDepartment, itemId: string, name: string) =>
  `${itemFilesPath(department, itemId)}?${new URLSearchParams({ name })}`;

/** Where to ask for an upload of one of the item's files. */
export const itemUploadsPath = (department: FileDepartment, itemId: string) =>
  `${itemPath(itemId)}/${department}-uploads`;

/** A short-lived link that opens or downloads one of the item's files. */
export const itemFileLinkPath = (department: FileDepartment, itemId: string, name: string) =>
  `${itemPath(itemId)}/${department}-file-link?${new URLSearchParams({ name })}`;

/** How many files each item has, for the department's column on the Overview
 *  (production-overview FR14, production-sfx-wardrobe FR10). */
export const fileCountsPath = (department: FileDepartment) =>
  `${PRODUCTION_PATH}/${department}-file-counts`;
