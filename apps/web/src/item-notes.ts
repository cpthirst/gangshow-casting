// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** Every item's notes in the production (casting-item-overview FR8, FR9). */
export const ITEM_NOTES_PATH = `/api/productions/${PRODUCTION_ID}/item-notes`;

/** Where an item's notes are saved. */
export const saveNotesPath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/notes`;

/** The most notes can hold (the shared schema's limit). */
export const MAX_NOTES = 500;
