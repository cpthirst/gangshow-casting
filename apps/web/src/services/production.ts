import {
  type DepartmentId,
  type FileDepartment,
  mayChangeProduction,
  newestFirst,
  newestProduction,
  type ProductionList,
  type Role,
} from "@app/shared";
import { shallowRef } from "vue";

// The production the app shows, held here and nowhere else, and the API's addresses for it. The
// app opens the newest when it starts (useOpenProduction), and pages are only shown once it has
// (ADR 0036). Someone can switch to an older one (simplify FR20), held here only, so it lasts
// until the app is next opened. Refs, so the sidebar and every page follow.
const open = shallowRef<string>();
/** The productions as the API last listed them. */
const listed = shallowRef<ProductionList["productions"]>();

/** Where the API lists the productions. */
export const PRODUCTIONS_PATH = "/api/productions";

/** The open production's year, if one has been opened. */
export const openProductionYear = () => open.value;

/** Opens the production with this year, or (undefined) none. */
export function openProduction(year: string | undefined) {
  open.value = year;
}

/** Keeps what the API says the productions are. */
export function listProductions(productions: ProductionList["productions"]) {
  listed.value = productions;
}

/** Keeps the list, and opens its newest. */
export function openNewestOf(productions: ProductionList["productions"]) {
  listProductions(productions);
  open.value = newestProduction(productions);
}

/** The years to switch between, newest first. */
export const listedProductionYears = () => newestFirst(listed.value ?? []);

/**
 * Whether the open production can be changed: only the newest (simplify FR21). Until the list
 * is known, as in component tests, nothing says otherwise; the API decides either way.
 */
export const isOpenProductionChangeable = () =>
  open.value === undefined ||
  listed.value === undefined ||
  mayChangeProduction(open.value, listed.value);

/** Where the API keeps everything about the open production. */
export function productionPath() {
  if (open.value === undefined) throw new Error("No production is open");
  return `${PRODUCTIONS_PATH}/${open.value}`;
}

export const castPath = () => `${productionPath()}/cast`;

/** Every prop in the production (production-props FR13). */
export const propsPath = () => `${productionPath()}/props`;

/** Where a new prop for this item is posted. */
export const addPropPath = (itemId: string) =>
  `${productionPath()}/items/${encodeURIComponent(itemId)}/props`;

/** Where one prop is edited (PUT) or removed (DELETE). */
export const propPath = (propId: number) => `${propsPath()}/${propId}`;

/** Every item's channels given out. */
export const micPlotPath = () => `${productionPath()}/mic-plot`;

/** Where one of the item's channels is given out or freed. */
export const allocateMicPath = (itemId: string) =>
  `${productionPath()}/items/${encodeURIComponent(itemId)}/mic-plot`;

/** The production's running order: GET answers with the latest saved version. */
export const runningOrderPath = () => `${productionPath()}/running-order`;

/** Every role in the production. */
export const rolesPath = () => `${productionPath()}/roles`;

/** Where an edited role is put. */
export const updateRolePath = (roleId: number) => `${rolesPath()}/${roleId}`;

/** Where a role is removed, if it's still at the revision shown. */
export const removeRolePath = (role: Role) => `${rolesPath()}/${role.id}?revision=${role.revision}`;

/** Where a new role for this item is posted. */
export const addRolePath = (itemId: string) =>
  `${productionPath()}/items/${encodeURIComponent(itemId)}/roles`;

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

const itemPath = (itemId: string) => `${productionPath()}/items/${encodeURIComponent(itemId)}`;

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
  `${productionPath()}/${department}-file-counts`;

/** The item's scenery files, as file storage holds them now (production-scenery FR6). */
export const sceneryFilesPath = (itemId: string) => itemFilesPath("scenery", itemId);

/** One of the item's files, to delete it (FR11). */
export const sceneryFilePath = (itemId: string, name: string) =>
  itemFilePath("scenery", itemId, name);

/** Where to ask for an upload of one of the item's files (FR8). */
export const sceneryUploadsPath = (itemId: string) => itemUploadsPath("scenery", itemId);

/** A short-lived link that opens or downloads one of the item's files (FR10). */
export const sceneryFileLinkPath = (itemId: string, name: string) =>
  itemFileLinkPath("scenery", itemId, name);

/** Every item's scenery notes, apart from its casting and props notes. */
export const sceneryNotesPath = () => departmentNotesPath("scenery");

/** Where an item's scenery notes are saved. */
export const saveSceneryNotesPath = (itemId: string) => saveDepartmentNotesPath("scenery", itemId);
