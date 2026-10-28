import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type ItemNote, ItemNoteList, ProductionId } from "@app/shared";
import { parseJson } from "#/http/json.ts";
import { ifExists } from "#/storage/files.ts";
import { oneAtATime, writePrivateFile } from "#/storage/private-file.ts";

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
): { note: ItemNote; list: ItemNoteList } | "stale" {
  const current = list.notes.find((note) => note.itemId === itemId);
  if ((current?.revision ?? 0) !== revision) return "stale";
  const note: ItemNote = { itemId, text, revision: revision + 1 };
  const notes = current
    ? list.notes.map((n) => (n.itemId === itemId ? note : n))
    : [...list.notes, note];
  return { note, list: { ...list, notes } };
}

/** The list with only the notes of the given items. */
const onlyItems = (list: ItemNoteList, itemIds: string[]): ItemNoteList => ({
  ...list,
  notes: list.notes.filter((note) => itemIds.includes(note.itemId)),
});

export function inMemoryItemNoteStore(): ItemNoteStore {
  const lists = new Map<string, ItemNoteList>();
  const listOf = (productionId: string) => lists.get(productionId) ?? empty(productionId);
  return {
    list: async (productionId) => listOf(productionId),
    async save(productionId, itemId, revision, text) {
      const saved = withNote(listOf(productionId), itemId, revision, text);
      if (saved === "stale") return saved;
      lists.set(productionId, saved.list);
      return saved.note;
    },
    async keepOnlyItems(productionId, itemIds) {
      lists.set(productionId, onlyItems(listOf(productionId), itemIds));
    },
  };
}

/** The file props notes are kept in, apart from the casting notes (production-props FR20). */
export const PROPS_NOTES_FILE = "props-notes.json";

/** Local file: `<dataDir>/<productionId>/item-notes.json` (git-ignored), or the file named,
 *  created with the first notes. Free text about a production of young people, so kept
 *  owner-only. */
export function fileItemNoteStore(dataDir: string, fileName = "item-notes.json"): ItemNoteStore {
  // The id becomes a folder name: never trust callers to have checked it.
  const fileFor = (productionId: string) => {
    if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
    return join(dataDir, productionId, fileName);
  };

  async function read(productionId: string) {
    const text = await ifExists(() => readFile(fileFor(productionId), "utf8"));
    if (text === undefined) return empty(productionId);
    const parsed = ItemNoteList.safeParse(parseJson(text));
    if (!parsed.success || parsed.data.productionId !== productionId) {
      throw new Error(`Item notes file for production ${productionId} is invalid`);
    }
    return parsed.data;
  }

  const inTurn = oneAtATime();
  return {
    list: read,
    save: (productionId, itemId, revision, text) =>
      // Checked and saved in one turn, so two saves from the same revision can't both win.
      inTurn(async () => {
        const saved = withNote(await read(productionId), itemId, revision, text);
        if (saved === "stale") return saved;
        await writePrivateFile(fileFor(productionId), JSON.stringify(saved.list, null, 2));
        return saved.note;
      }),
    keepOnlyItems: (productionId, itemIds) =>
      inTurn(async () => {
        const list = await read(productionId);
        const kept = onlyItems(list, itemIds);
        // Nothing to write if every item stays (or there's no file yet).
        if (kept.notes.length === list.notes.length) return;
        await writePrivateFile(fileFor(productionId), JSON.stringify(kept, null, 2));
      }),
  };
}
