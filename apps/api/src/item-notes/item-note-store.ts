import { type ItemNote, ItemNoteList } from "@app/shared";
import {
  type Change,
  documentsInFiles,
  documentsInMemory,
  keepOnlyRowsOfItems,
  type ProductionDocuments,
} from "#/storage/production-documents.ts";

/** Where each production's item notes live: one mutable document, no history
 *  (casting-item-overview FR8). */
export interface ItemNoteStore {
  /** Every item's notes; none until the first is saved. */
  list(productionId: string): Promise<ItemNoteList>;
  /** Replaces an item's notes (revision + 1), if they're still at the given revision (0 for
   *  an item with none yet). Cleared notes are kept as "", so stale saves are still caught. */
  save(
    productionId: string,
    itemId: string,
    revision: number,
    text: string,
  ): Promise<ItemNote | "stale">;
  /** Deletes the notes of every item not in `itemIds`, for good: nothing about an item
   *  that has left the show is kept (running-order E3.S2). */
  keepOnlyItems(productionId: string, itemIds: string[]): Promise<void>;
}

const empty = (productionId: string): ItemNoteList => ({ productionId, notes: [] });

/** The list with one item's notes saved, or "stale" if they've moved on since `revision`. */
function withNote(
  list: ItemNoteList,
  itemId: string,
  revision: number,
  text: string,
): Change<ItemNoteList, ItemNote | "stale"> {
  const current = list.notes.find((note) => note.itemId === itemId);
  if ((current?.revision ?? 0) !== revision) return { answer: "stale" };
  const note: ItemNote = { itemId, text, revision: revision + 1 };
  const notes = current
    ? list.notes.map((n) => (n.itemId === itemId ? note : n))
    : [...list.notes, note];
  return { answer: note, save: { ...list, notes } };
}

/** An item note store's rules, wherever its files are kept. */
function itemNoteStoreOver(files: ProductionDocuments<ItemNoteList>): ItemNoteStore {
  return {
    list: files.read,
    // Checked and saved in one turn, so two saves from the same revision can't both win.
    save: (productionId, itemId, revision, text) =>
      files.change(productionId, (list) => withNote(list, itemId, revision, text)),
    keepOnlyItems: (productionId, itemIds) =>
      keepOnlyRowsOfItems(
        files,
        productionId,
        itemIds,
        (list) => list.notes,
        (list, notes) => ({ ...list, notes }),
      ),
  };
}

export const inMemoryItemNoteStore = () =>
  itemNoteStoreOver(documentsInMemory<ItemNoteList>([], empty));

/** The file props notes are kept in, apart from the casting notes (production-props FR20). */
export const PROPS_NOTES_FILE = "props-notes.json";
/** The file scenery notes are kept in, apart from the others (production-scenery E2.S1). */
export const SCENERY_NOTES_FILE = "scenery-notes.json";
/** The file SFX notes are kept in, apart from the others (production-sfx-wardrobe FR8). */
export const SFX_NOTES_FILE = "sfx-notes.json";
/** The file Wardrobe notes are kept in, apart from the others (production-sfx-wardrobe FR8). */
export const WARDROBE_NOTES_FILE = "wardrobe-notes.json";
/** The file Mic plot notes are kept in, apart from the others (production-mics FR8). */
export const MIC_PLOT_NOTES_FILE = "mic-plot-notes.json";

/** Local file: `<dataDir>/<productionId>/item-notes.json` (git-ignored), or the file named,
 *  created with the first notes. Free text about a production of young people, so kept
 *  owner-only. */
export const fileItemNoteStore = (dataDir: string, fileName = "item-notes.json") =>
  itemNoteStoreOver(
    documentsInFiles({ dataDir, fileName, label: "Item notes", schema: ItemNoteList, empty }),
  );
