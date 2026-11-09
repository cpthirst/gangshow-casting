import type { DepartmentId } from "@app/shared";
import { productionPath } from "./production.ts";

/** Every item's notes in the production (casting-item-overview FR8, FR9). */
export const itemNotesPath = () => `${productionPath()}/item-notes`;

/** Where an item's notes are saved. */
export const saveNotesPath = (itemId: string) =>
  `${productionPath()}/items/${encodeURIComponent(itemId)}/notes`;

/** Every item's notes for the department, apart from its other departments'. Casting's are
 *  the item's own notes; every other department's are named after it. */
export const departmentNotesPath = (department: DepartmentId) =>
  department === "casting" ? itemNotesPath() : `${productionPath()}/${department}-notes`;

/** Where an item's notes for the department are saved. */
export const saveDepartmentNotesPath = (department: DepartmentId, itemId: string) =>
  department === "casting"
    ? saveNotesPath(itemId)
    : `${productionPath()}/items/${encodeURIComponent(itemId)}/${department}-notes`;
