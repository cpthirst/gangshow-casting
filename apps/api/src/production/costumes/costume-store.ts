import { type Costume, CostumeList, type Role } from "@app/shared";
import {
  type Change,
  documentsInFiles,
  documentsInMemory,
  keepOnlyRows,
  type ProductionDocuments,
} from "#/storage/production-documents.ts";

/** A row's fields as a save sends them, without the revision it will be saved at. */
export type CostumeChange = Omit<Costume, "revision">;

/** Where each production's costumes live: what each cast member wears in each role in each
 *  item (production-costume-sheets FR4, FR8). */
export interface CostumeStore {
  /** Every row anyone has saved. */
  list(productionId: string): Promise<CostumeList>;
  /**
   * Saves a row's three fields together (revision + 1), if it's still at the given revision
   * (0 for a row nobody has saved), answering with it. A row emptied of all three is kept as
   * "", so a stale save is still caught (FR7). Whether the cast member plays the role, and the
   * role is in the item, is the caller's to check; `role` is the role as the caller read it.
   * The remote store also refuses, as stale, a save once that role has changed or the cast
   * member has been deleted, so a save racing a recast or a delete leaves nothing behind
   * (ADR 0010). The local files are one person's, so they don't.
   */
  save(
    productionId: string,
    costume: CostumeChange,
    revision: number,
    role: Role,
  ): Promise<Costume | "stale">;
  /** Deletes the costumes of every item not in `itemIds`, for good (FR8). */
  keepOnlyItems(productionId: string, itemIds: string[]): Promise<void>;
  /** Deletes the costumes of every role not in `roleIds`, for good: a role removed from its
   *  item takes its rows with it (FR8). Someone recast out of a role keeps theirs, unseen, in
   *  case they're recast back. */
  keepOnlyRoles(productionId: string, roleIds: number[]): Promise<void>;
  /** Deletes a cast member's costumes in every item, for good (FR8, ADR 0010). */
  deleteCostumesOf(productionId: string, castMemberId: number): Promise<void>;
}

const empty = (productionId: string): CostumeList => ({ productionId, costumes: [] });

/** Whether two costumes are the same row: one cast member in one role. A role is in one item
 *  only, so the item needn't be compared. */
export const sameRow = (a: CostumeChange, b: CostumeChange) =>
  a.roleId === b.roleId && a.castMemberId === b.castMemberId;

/** The list with one row saved, or "stale" if it has moved on since `revision`. */
function withCostume(
  list: CostumeList,
  change: CostumeChange,
  revision: number,
): Change<CostumeList, Costume | "stale"> {
  const current = list.costumes.find((c) => sameRow(c, change));
  if ((current?.revision ?? 0) !== revision) return { answer: "stale" };
  const costume = { ...change, revision: revision + 1 };
  const costumes = [...list.costumes.filter((c) => !sameRow(c, change)), costume];
  return { answer: costume, save: { ...list, costumes } };
}

/** A costume store's rules, wherever its files are kept. */
function costumeStoreOver(files: ProductionDocuments<CostumeList>): CostumeStore {
  const keepOnly = (productionId: string, keep: (costume: Costume) => boolean) =>
    keepOnlyRows(
      files,
      productionId,
      keep,
      (list) => list.costumes,
      (list, costumes) => ({ ...list, costumes }),
    );
  return {
    list: files.read,
    // Checked and saved in one turn, so two saves from the same revision can't both win.
    save: (productionId, costume, revision) =>
      files.change(productionId, (list) => withCostume(list, costume, revision)),
    // Through keepOnly, as the costumes' other clean-ups are, rather than keepOnlyRowsOfItems.
    keepOnlyItems: (productionId, itemIds) =>
      keepOnly(productionId, (costume) => itemIds.includes(costume.itemId)),
    keepOnlyRoles: (productionId, roleIds) =>
      keepOnly(productionId, (costume) => roleIds.includes(costume.roleId)),
    deleteCostumesOf: (productionId, castMemberId) =>
      keepOnly(productionId, (costume) => costume.castMemberId !== castMemberId),
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
