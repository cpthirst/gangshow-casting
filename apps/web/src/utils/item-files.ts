import { type FileDepartment, stores } from "@app/shared";

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

// The same rule as its store's, which says it once (stores FR14).
export const sceneryDepartment: FilesDepartment = {
  key: "scenery",
  uploadRule: stores.scenery.uploadRule,
};

export const sfxDepartment: FilesDepartment = { key: "sfx" };

// Its rule stands in for checking each file, as Scenery's does (production-sfx-wardrobe FR4,
// ADR 0010).
export const wardrobeDepartment: FilesDepartment = {
  key: "wardrobe",
  uploadRule: stores.wardrobe.uploadRule,
};
