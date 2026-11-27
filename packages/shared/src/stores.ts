import { type DepartmentId, departments } from "./api-routes.ts";

/**
 * The show's stores: what a Production department keeps from one show to the next, outside
 * every production (stores FR2, ADR 0043). Each is its department's, named by it, in the
 * sidebar's order. A store added later joins this list only (FR3).
 */
export const storeIds = ["scenery", "props", "wardrobe"] as const satisfies readonly DepartmentId[];
export type StoreId = (typeof storeIds)[number];

/** The store an id names, or undefined: a department such as SFX has none. */
export const storeOf = (id: unknown): StoreId | undefined => storeIds.find((store) => store === id);

/** A store's page, as the router and the Usage page name it. */
export const storePageName = (store: StoreId) => `${store}-stores` as const;

/** A store's title: "Scenery stores". */
export const storeTitle = (store: StoreId) => `${departments[store].name} stores`;

/** The stores' folder in file storage, beside the productions', whose folders are their
 *  years, so no production's clean-up reaches it (ADR 0036, ADR 0043). */
export const STORES_FOLDER = "stores";

/** A store's place in file storage: `stores/<store>/`. */
export const storeFolderOf = (store: StoreId) => `${STORES_FOLDER}/${store}/`;
