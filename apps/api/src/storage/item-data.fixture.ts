import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileDepartments } from "@app/shared";
import type { ItemNoteStore } from "#/item-notes/item-note-store.ts";
import type { ItemFileStores } from "#/production/item-files/item-file-store.ts";
import type { ItemCleanup } from "#/show/running-order/save-running-order.ts";
import type { Stores } from "./data-stores.ts";

// Made-up data only (CLAUDE.md safeguarding).

/** Gives the item some of every kind of data kept per item: casting and casting notes, props
 *  and props notes, scenery, SFX and Wardrobe files and notes, and a mic plot and its notes.
 *  The files go in `folder`, laid out as the folder file stores keep them. */
export async function seedEveryKind(
  stores: Stores,
  folder: string,
  productionId: string,
  itemId: string,
) {
  await stores.roles.add(productionId, itemId, {
    name: "Captain Hook",
    size: "lead",
    castMemberIds: [1],
  });
  await stores.props.add(productionId, itemId, {
    name: "Cutlass",
    quantity: 1,
    roleIds: [],
    carrierIds: [1],
  });
  await stores.micPlots.allocate(productionId, itemId, 1, 1);
  for (const notes of notesOf(stores)) await notes.save(productionId, itemId, 0, "Made-up note");
  for (const department of fileDepartments) {
    const place = join(folder, productionId, itemId, department);
    await mkdir(place, { recursive: true });
    await writeFile(join(place, "made-up.pdf"), "made-up");
  }
}

const notesOf = (stores: Stores): ItemNoteStore[] => [
  stores.itemNotes,
  stores.propsNotes,
  stores.sceneryNotes,
  stores.sfxNotes,
  stores.wardrobeNotes,
  stores.micPlotNotes,
];

/** How many of each kind of data are kept for the item, by the kind's name in the clean-up. */
export async function keptFor(
  stores: Stores,
  files: ItemFileStores,
  productionId: string,
  itemId: string,
) {
  const ofItem = (list: { itemId: string }[]) => list.filter((x) => x.itemId === itemId).length;
  const notes = (store: ItemNoteStore) => store.list(productionId).then((l) => ofItem(l.notes));
  const filesOf = (department: keyof ItemFileStores) =>
    files[department].list(productionId, itemId).then((l) => l.length);
  return {
    roles: ofItem((await stores.roles.list(productionId)).roles),
    itemNotes: await notes(stores.itemNotes),
    props: ofItem((await stores.props.list(productionId)).props),
    propsNotes: await notes(stores.propsNotes),
    sceneryFiles: await filesOf("scenery"),
    sceneryNotes: await notes(stores.sceneryNotes),
    sfxFiles: await filesOf("sfx"),
    sfxNotes: await notes(stores.sfxNotes),
    wardrobeFiles: await filesOf("wardrobe"),
    wardrobeNotes: await notes(stores.wardrobeNotes),
    micPlots: ofItem((await stores.micPlots.list(productionId)).items),
    micPlotNotes: await notes(stores.micPlotNotes),
  };
}

/** What keptFor answers for an item with n of every kind the clean-up removes: a kind the
 *  fixture doesn't seed and count shows up by name. */
export const eachKindOf = (cleanup: ItemCleanup, n: number) =>
  Object.fromEntries(Object.keys(cleanup).map((kind) => [kind, n]));
