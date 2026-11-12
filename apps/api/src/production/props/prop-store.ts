import { Prop, type PropDetails, PropList, type Role } from "@app/shared";
import {
  type Change,
  documentsInFiles,
  documentsInMemory,
  keepOnlyRowsOfItems,
  type ProductionDocuments,
  saveRevised,
} from "#/storage/production-documents.ts";
import { castCarriers } from "./prop-links.ts";

/** Where each production's props live (production-props FR13): the production's own, apart from
 *  its casting. */
export interface PropStore {
  /** Every item's props; none until the first is added. */
  list(productionId: string): Promise<PropList>;
  /** Adds a prop to an item, with the next unused id. */
  add(productionId: string, itemId: string, details: PropDetails): Promise<Prop>;
  /** Replaces a prop's name, quantity, roles and carriers; it stays on its item. */
  update(productionId: string, id: number, details: PropDetails): Promise<Prop | "not-found">;
  /** Removes a prop for good (production-props FR19). Its id is never reused. */
  remove(productionId: string, id: number): Promise<"removed" | "not-found">;
  /** Takes off every prop's carriers who no longer play one of its roles (production-props
   *  FR28). roles: every role in the production, as it is now. */
  dropStrayCarriers(productionId: string, roles: Role[]): Promise<void>;
  /** Deletes the props of every item not in `itemIds`, for good: nothing about an item that
   *  has left the show is kept, not even who carried its props. Their ids are never reused. */
  keepOnlyItems(productionId: string, itemIds: string[]): Promise<void>;
}

// The stored file also remembers the next id, so a removed prop's id is never reused.
const PropFile = PropList.extend({ nextId: Prop.shape.id.optional() });
type PropFile = ReturnType<typeof PropFile.parse>;

const emptyFile = (productionId: string): PropFile => ({ productionId, props: [] });

// The stored next id, but never one that's already taken (e.g. after a hand edit).
const nextIdOf = (file: PropFile) =>
  Math.max(file.nextId ?? 0, Math.max(0, ...file.props.map((prop) => prop.id)) + 1);

const listOf = ({ productionId, props }: PropFile): PropList => ({ productionId, props });

/** The file with a new prop added to the item under the next id. */
function withNewProp(file: PropFile, itemId: string, details: PropDetails): Change<PropFile, Prop> {
  const prop: Prop = { ...details, id: nextIdOf(file), itemId };
  return { answer: prop, save: { ...file, props: [...file.props, prop], nextId: prop.id + 1 } };
}

/** The file with one prop's name, quantity, roles and carriers replaced, or why not. */
function withUpdatedProp(
  file: PropFile,
  id: number,
  details: PropDetails,
): Change<PropFile, Prop | "not-found"> {
  const prop = file.props.find((p) => p.id === id);
  if (!prop) return { answer: "not-found" };
  const updated: Prop = { ...prop, ...details };
  return {
    answer: updated,
    save: { ...file, props: file.props.map((p) => (p.id === id ? updated : p)) },
  };
}

/** The file without the prop, or why not. Keeps nextId, so its id is never reused. */
function withoutProp(file: PropFile, id: number): Change<PropFile, "removed" | "not-found"> {
  if (!file.props.some((p) => p.id === id)) return { answer: "not-found" };
  // nextId is worked out before filtering, so the removed id stays taken.
  return {
    answer: "removed",
    save: { ...file, props: file.props.filter((p) => p.id !== id), nextId: nextIdOf(file) },
  };
}

/** The file with only carriers who still play one of their prop's roles. */
const withCastCarriers = (file: PropFile, roles: Role[]): PropFile => ({
  ...file,
  props: file.props.map((prop) => ({ ...prop, carrierIds: castCarriers(prop, roles) })),
});

/** The file with only the props given. Keeps nextId, so the others' ids stay taken. */
const withOnly = (file: PropFile, props: Prop[]): PropFile => ({
  ...file,
  props,
  nextId: nextIdOf(file),
});

/** A prop store's rules, wherever its files are kept. */
function propStoreOver(files: ProductionDocuments<PropFile>): PropStore {
  return {
    list: async (productionId) => listOf(await files.read(productionId)),
    // Read and saved in one turn, so two adds at once can't take the same id.
    add: (productionId, itemId, details) =>
      files.change(productionId, (file) => withNewProp(file, itemId, details)),
    update: (productionId, id, details) =>
      files.change(productionId, (file) => withUpdatedProp(file, id, details)),
    // The file is rewritten without it: no copy is kept.
    remove: (productionId, id) => files.change(productionId, (file) => withoutProp(file, id)),
    dropStrayCarriers: (productionId, roles) =>
      // No props, no carriers: nothing to save, and no file made.
      saveRevised(files, productionId, (file) =>
        file.props.length === 0 ? undefined : withCastCarriers(file, roles),
      ),
    keepOnlyItems: (productionId, itemIds) =>
      keepOnlyRowsOfItems(files, productionId, itemIds, (file) => file.props, withOnly),
  };
}

/** Props held in memory, starting with those given: for tests. */
export const inMemoryPropStore = (saved: PropList[] = []) =>
  propStoreOver(documentsInMemory<PropFile>(saved, emptyFile));

/** Local file: `<dataDir>/<productionId>/props.json` (git-ignored), created with the first
 *  prop. */
export const filePropStore = (dataDir: string) =>
  propStoreOver(
    documentsInFiles({
      dataDir,
      fileName: "props.json",
      label: "Props",
      schema: PropFile,
      empty: emptyFile,
    }),
  );
