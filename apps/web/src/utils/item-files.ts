import {
  type AnyOf,
  type FileDepartment,
  SCENERY_PERMISSIONS,
  SFX_PERMISSIONS,
  WARDROBE_PERMISSIONS,
} from "@app/shared";

// Each item's files and notes for a Production department, Scenery's, SFX's or Wardrobe's,
// which share one page layout (production-sfx-wardrobe FR2) and the API's routes, each named
// after it.

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** A department whose item page keeps the item's files and notes. */
export interface FilesDepartment {
  /** Its word in the API's routes: …/items/{itemId}/<key>-files, …/<key>-notes. */
  key: FileDepartment;
  /** As the page's title says it: "Scenery: Opening Number". */
  name: string;
  /** Mid-sentence, as in "No scenery files for this item yet." */
  noun: string;
  /** The item page's route name. */
  route: string;
  /** Who may change it, any one of these, or an admin. */
  permissions: AnyOf;
  /** What the upload area says the files must be, if anything. */
  uploadRule?: string;
  /** The page's help, if it has any yet. */
  help?: string;
}

export const sceneryDepartment: FilesDepartment = {
  key: "scenery",
  name: "Scenery",
  noun: "scenery",
  route: "scenery-item",
  permissions: SCENERY_PERMISSIONS,
  uploadRule: "Scenery and set images only: no photos of cast members.",
  help: "scenery-item",
};

export const sfxDepartment: FilesDepartment = {
  key: "sfx",
  name: "SFX",
  noun: "SFX",
  route: "sfx-item",
  permissions: SFX_PERMISSIONS,
  help: "sfx-item",
};

// Its rule stands in for checking each file, as Scenery's does (production-sfx-wardrobe FR4,
// ADR 0010).
export const wardrobeDepartment: FilesDepartment = {
  key: "wardrobe",
  name: "Wardrobe",
  noun: "Wardrobe",
  route: "wardrobe-item",
  permissions: WARDROBE_PERMISSIONS,
  uploadRule: "Costume designs and images only: no photos of cast members.",
  help: "wardrobe-item",
};

const itemPath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}`;

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
  `/api/productions/${PRODUCTION_ID}/${department}-file-counts`;

/** Every item's notes for the department, apart from its other notes. */
export const departmentNotesPath = (department: FileDepartment) =>
  `/api/productions/${PRODUCTION_ID}/${department}-notes`;

/** Where an item's notes for the department are saved. */
export const saveDepartmentNotesPath = (department: FileDepartment, itemId: string) =>
  `${itemPath(itemId)}/${department}-notes`;
