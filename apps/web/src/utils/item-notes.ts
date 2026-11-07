import type { DepartmentId } from "@app/shared";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** Every item's notes in the production (casting-item-overview FR8, FR9). */
export const ITEM_NOTES_PATH = `/api/productions/${PRODUCTION_ID}/item-notes`;

/** Where an item's notes are saved. */
export const saveNotesPath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/notes`;

/** Every item's notes for the department, apart from its other departments'. Casting's are
 *  the item's own notes; every other department's are named after it. */
export const departmentNotesPath = (department: DepartmentId) =>
  department === "casting"
    ? ITEM_NOTES_PATH
    : `/api/productions/${PRODUCTION_ID}/${department}-notes`;

/** Where an item's notes for the department are saved. */
export const saveDepartmentNotesPath = (department: DepartmentId, itemId: string) =>
  department === "casting"
    ? saveNotesPath(itemId)
    : `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/${department}-notes`;
