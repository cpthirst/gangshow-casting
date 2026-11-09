import { CastList, CastMember, type CastMemberDetails } from "@app/shared";
import {
  type Change,
  documentsInFiles,
  documentsInMemory,
  type ProductionDocuments,
  saveRevised,
} from "#/storage/production-documents.ts";

/** Where each production's cast list lives: one mutable document, no history (ADR 0010). */
export interface CastStore {
  list(productionId: string): Promise<CastList | undefined>;
  /** Gives a new production its empty cast list; one that already has a list keeps it. */
  start(productionId: string): Promise<void>;
  /** Adds a member with the next unused id; undefined if the production has no cast list. */
  add(productionId: string, details: CastMemberDetails): Promise<CastMember | undefined>;
  /** Replaces a member's details, if they're still at the given revision. */
  update(
    productionId: string,
    id: number,
    revision: number,
    details: CastMemberDetails,
  ): Promise<CastMember | Refusal>;
  /** Removes a member for good, if they're still at the given revision. */
  remove(productionId: string, id: number, revision: number): Promise<"removed" | Refusal>;
}

/** Why a change to one member was refused: it's gone, or someone else changed it first. */
export type Refusal = "stale" | "not-found";

/** HTTP status for a refused change to one cast member. */
export const refusalStatus: Record<Refusal, number> = { stale: 409, "not-found": 404 };

// The stored file also remembers the next id, so a deleted member's id is never reused.
const CastFile = CastList.extend({ nextId: CastMember.shape.id.optional() });
type CastFile = ReturnType<typeof CastFile.parse>;

// The stored next id, but never one that's already taken (e.g. after a hand edit).
const nextIdOf = (file: CastFile) =>
  Math.max(file.nextId ?? 0, Math.max(0, ...file.members.map((member) => member.id)) + 1);

const listOf = ({ productionId, members }: CastFile): CastList => ({ productionId, members });

/** The file with a new member added under the next id. */
function withNewMember(
  file: CastFile,
  details: CastMemberDetails,
): Change<CastFile, CastMember | undefined> {
  const member: CastMember = { ...details, id: nextIdOf(file), revision: 1 };
  return {
    answer: member,
    save: { ...file, members: [...file.members, member], nextId: member.id + 1 },
  };
}

/** The file with the member's details replaced (revision + 1), or why not. */
function withUpdatedMember(
  file: CastFile | undefined,
  id: number,
  revision: number,
  details: CastMemberDetails,
): Change<CastFile, CastMember | Refusal> {
  const member = file?.members.find((m) => m.id === id);
  if (!file || !member) return { answer: "not-found" };
  if (member.revision !== revision) return { answer: "stale" };
  const updated: CastMember = { ...details, id, revision: revision + 1 };
  return {
    answer: updated,
    save: { ...file, members: file.members.map((m) => (m.id === id ? updated : m)) },
  };
}

/** The file without the member, or why not. Keeps nextId, so their id is never reused. */
function withoutMember(
  file: CastFile | undefined,
  id: number,
  revision: number,
): Change<CastFile, "removed" | Refusal> {
  const member = file?.members.find((m) => m.id === id);
  if (!file || !member) return { answer: "not-found" };
  if (member.revision !== revision) return { answer: "stale" };
  return {
    answer: "removed",
    save: { ...file, members: file.members.filter((m) => m.id !== id), nextId: nextIdOf(file) },
  };
}

/** A cast store's rules, wherever its files are kept. */
function castStoreOver(files: ProductionDocuments<CastFile, CastFile | undefined>): CastStore {
  return {
    list: async (productionId) => {
      const file = await files.read(productionId);
      return file && listOf(file);
    },
    start: (productionId) =>
      saveRevised(files, productionId, (file) =>
        file ? undefined : { productionId, members: [] },
      ),
    add: (productionId, details) =>
      files.change(productionId, (file) =>
        file ? withNewMember(file, details) : { answer: undefined },
      ),
    update: (productionId, id, revision, details) =>
      files.change(productionId, (file) => withUpdatedMember(file, id, revision, details)),
    // The file is rewritten without them: no copy or history is kept (ADR 0010).
    remove: (productionId, id, revision) =>
      files.change(productionId, (file) => withoutMember(file, id, revision)),
  };
}

const noFile = () => undefined;

export const inMemoryCastStore = (initial: CastList[] = []) =>
  castStoreOver(documentsInMemory<CastFile, undefined>(initial, noFile));

/** Local file: `<dataDir>/<productionId>/cast.json` (git-ignored). */
export const fileCastStore = (dataDir: string) =>
  castStoreOver(
    documentsInFiles<CastFile, undefined>({
      dataDir,
      fileName: "cast.json",
      label: "Cast",
      schema: CastFile,
      empty: noFile,
    }),
  );
