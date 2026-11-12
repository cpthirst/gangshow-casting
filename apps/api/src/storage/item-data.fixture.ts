import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileDepartments } from "@app/shared";
import type { ItemNoteStore } from "#/item-notes/item-note-store.ts";
import { aCostume } from "#/production/costumes/costume-store.contract.ts";
import type { ItemFileStores } from "#/production/item-files/item-file-store.ts";
import { jo } from "#/show/cast/cast.fixture.ts";
import type { ItemCleanup } from "#/show/running-order/save-running-order.ts";
import type { Stores } from "./data-stores.ts";

// Made-up data only (CLAUDE.md safeguarding).

/** Gives the item some of every kind of data kept per item: casting and casting notes, props
 *  and props notes, scenery, SFX and Wardrobe files and notes, a costume, and a mic plot and
 *  its notes, for someone on the cast list.
 *  The files go in `folder`, laid out as the folder file stores keep them. */
export async function seedEveryKind(
  stores: Stores,
  folder: string,
  productionId: string,
  itemId: string,
) {
  // Someone on the cast list to be in it: the remote costume store saves only for them.
  await stores.cast.start(productionId);
  const member =
    (await stores.cast.list(productionId))?.members[0] ?? (await stores.cast.add(productionId, jo));
  if (!member) throw new Error("expected a cast member");
  const role = await stores.roles.add(productionId, itemId, {
    name: "Captain Hook",
    size: "lead",
    castMemberIds: [member.id],
  });
  if (role === "name-taken") throw new Error("expected a new role");
  await stores.costumes.save(productionId, aCostume(itemId, role.id, member.id), 0, role);
  await stores.props.add(productionId, itemId, {
    name: "Cutlass",
    quantity: 1,
    roleIds: [],
    carrierIds: [member.id],
  });
  await stores.micPlots.allocate(productionId, itemId, 1, member.id);
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
    costumes: ofItem((await stores.costumes.list(productionId)).costumes),
    micPlots: ofItem((await stores.micPlots.list(productionId)).items),
    micPlotNotes: await notes(stores.micPlotNotes),
  };
}

/** What keptFor answers for an item with n of every kind the clean-up removes: a kind the
 *  fixture doesn't seed and count shows up by name. */
export const eachKindOf = (cleanup: ItemCleanup, n: number) =>
  Object.fromEntries(Object.keys(cleanup).map((kind) => [kind, n]));
