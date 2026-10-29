import { z } from "zod";
import { ProductionId, RunningOrderItem } from "./running-order.ts";

/** The most an item's notes can hold, in characters (casting-item-overview FR8). */
export const MAX_NOTE_LENGTH = 500;

/** Casting notes on one item (casting-item-overview FR8): kept by the item's id, apart from
 *  the running order's Comments, so they survive new running-order versions. Props notes
 *  (production-props FR20) take the same shapes, at their own routes, kept apart from these. */
export const ItemNote = z.strictObject({
  itemId: RunningOrderItem.shape.id,
  /** Free text; "" once cleared. */
  text: z.string().max(MAX_NOTE_LENGTH),
  /** Goes up on every save, so a stale save can be refused (FR10). */
  revision: z.number().int().min(1),
});

/** GET /api/productions/{productionId}/item-notes, and the props and scenery equivalents
 *  (/props-notes, /scenery-notes): every item's notes. */
export const ItemNoteList = z.strictObject({
  productionId: ProductionId,
  notes: z.array(ItemNote).max(1000),
});

/**
 * PUT /api/productions/{productionId}/items/{itemId}/notes, or its props or scenery equivalent:
 * the new text (trimmed; "" clears the notes) and the revision it was based on, 0 for an item with no notes yet.
 * 200 returns the saved ItemNote; 409 means someone else saved first.
 */
export const SaveItemNoteRequest = z.strictObject({
  text: z.string().trim().max(MAX_NOTE_LENGTH),
  revision: z.number().int().min(0),
});

export type ItemNote = z.infer<typeof ItemNote>;
export type ItemNoteList = z.infer<typeof ItemNoteList>;
export type SaveItemNoteRequest = z.infer<typeof SaveItemNoteRequest>;
