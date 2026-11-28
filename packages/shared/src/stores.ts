import {
  type Access,
  type AnyOf,
  type DepartmentId,
  departments,
  mayChange,
  STAGE_GROUP,
  WARDROBE_GROUP,
} from "./api-routes.ts";

/**
 * The show's stores: what a Production department keeps from one show to the next, outside
 * every production (stores FR2, ADR 0043). Each is its department's, named by it, in the
 * sidebar's order. A store added later joins this list only (FR3).
 */
export const storeIds = ["scenery", "props", "wardrobe"] as const satisfies readonly DepartmentId[];
export type StoreId = (typeof storeIds)[number];

/** A store: who may change it, and what its upload area says its images must be. */
export interface Store {
  /** Any one of these allows a change, as well as an admin. */
  changedBy: AnyOf;
  /** The rule against photos of cast members, which stands in for checking each image
   *  (ADR 0010). */
  uploadRule: string;
}

/**
 * Each store, stated once, for the API and the page (stores FR4, FR5). Each is changed by its
 * own department's permission only: never a Director's, who changes a production's
 * departments, nor Tech's, who shares a production's scenery but not the Scenery store.
 */
export const stores: Readonly<Record<StoreId, Store>> = {
  scenery: {
    changedBy: [STAGE_GROUP],
    uploadRule: "Scenery and set images only: no photos of cast members.",
  },
  props: { changedBy: [STAGE_GROUP], uploadRule: "Props images only: no photos of cast members." },
  wardrobe: {
    changedBy: [WARDROBE_GROUP],
    uploadRule: "Costume designs and images only: no photos of cast members.",
  },
};

/** Whether access allows changing a store: an admin may change every one. */
export const mayChangeStore = (access: Access, store: StoreId) =>
  mayChange(access, stores[store].changedBy);

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
