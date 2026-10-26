// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** Every item's props notes in the production, apart from its casting notes (stage-props
 *  FR14, FR20). */
export const PROPS_NOTES_PATH = `/api/productions/${PRODUCTION_ID}/props-notes`;

/** Where an item's props notes are saved. */
export const savePropsNotesPath = (itemId: string) =>
  `/api/productions/${PRODUCTION_ID}/items/${encodeURIComponent(itemId)}/props-notes`;
