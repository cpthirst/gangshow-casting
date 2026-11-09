import type { DepartmentId } from "@app/shared";
import { PRODUCTION_PATH } from "./production.ts";

/** Every item's notes in the production (casting-item-overview FR8, FR9). */
export const ITEM_NOTES_PATH = `${PRODUCTION_PATH}/item-notes`;

/** Where an item's notes are saved. */
export const saveNotesPath = (itemId: string) =>
  `${PRODUCTION_PATH}/items/${encodeURIComponent(itemId)}/notes`;

/** Every item's notes for the department, apart from its other departments'. Casting's are
 *  the item's own notes; every other department's are named after it. */
export const departmentNotesPath = (department: DepartmentId) =>
  department === "casting" ? ITEM_NOTES_PATH : `${PRODUCTION_PATH}/${department}-notes`;

/** Where an item's notes for the department are saved. */
export const saveDepartmentNotesPath = (department: DepartmentId, itemId: string) =>
  department === "casting"
    ? saveNotesPath(itemId)
    : `${PRODUCTION_PATH}/items/${encodeURIComponent(itemId)}/${department}-notes`;
