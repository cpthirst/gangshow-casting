import { type Costume, CostumeList, isEmptyCostume } from "@app/shared";
import {
  type Change,
  documentsInFiles,
  documentsInMemory,
  keepOnlyRowsOfItems,
  type ProductionDocuments,
} from "#/storage/production-documents.ts";

/** Where each production's costumes live: what each cast member wears in each role in each
 *  item (production-costume-sheets FR4, FR8). */
export interface CostumeStore {
  /** Every row with any text; a row nobody has filled in isn't kept. */
  list(productionId: string): Promise<CostumeList>;
  /** Saves a row's three fields together, answering with it. A row emptied of all three is
   *  no longer kept. Whether the cast member plays the role, and the role is in the item, is
   *  the caller's to check. */
  save(productionId: string, costume: Costume): Promise<Costume>;
  /** Deletes the costumes of every item not in `itemIds`, for good (FR8). */
  keepOnlyItems(productionId: string, itemIds: string[]): Promise<void>;
}

const empty = (productionId: string): CostumeList => ({ productionId, costumes: [] });

/** Whether two costumes are the same row: one cast member in one role. A role is in one item
 *  only, so the item needn't be compared. */
const sameRow = (a: Costume, b: Costume) =>
  a.roleId === b.roleId && a.castMemberId === b.castMemberId;

/** The list with one row saved, or dropped once it's empty. */
function withCostume(list: CostumeList, costume: Costume): Change<CostumeList, Costume> {
  const others = list.costumes.filter((c) => !sameRow(c, costume));
  const costumes = isEmptyCostume(costume) ? others : [...others, costume];
  return { answer: costume, save: { ...list, costumes } };
}

/** A costume store's rules, wherever its files are kept. */
function costumeStoreOver(files: ProductionDocuments<CostumeList>): CostumeStore {
  return {
    list: files.read,
    save: (productionId, costume) =>
      files.change(productionId, (list) => withCostume(list, costume)),
    keepOnlyItems: (productionId, itemIds) =>
      keepOnlyRowsOfItems(
        files,
        productionId,
        itemIds,
        (list) => list.costumes,
        (list, costumes) => ({ ...list, costumes }),
      ),
  };
}

/** Costumes held in memory, starting with those given: for tests. */
export const inMemoryCostumeStore = (saved: CostumeList[] = []) =>
  costumeStoreOver(documentsInMemory<CostumeList>(saved, empty));

/** Local file: `<dataDir>/<productionId>/costumes.json` (git-ignored), created with the first
 *  costume saved. It links children to what they wear, so kept owner-only. */
export const fileCostumeStore = (dataDir: string) =>
  costumeStoreOver(
    documentsInFiles<CostumeList>({
      dataDir,
      fileName: "costumes.json",
      label: "Costumes",
      schema: CostumeList,
      empty,
    }),
  );
