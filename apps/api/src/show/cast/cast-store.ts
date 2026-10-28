import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CastList, CastMember, type CastMemberDetails, ProductionId } from "@app/shared";
import { parseJson } from "#/http/json.ts";
import { ifExists } from "#/storage/files.ts";
import { oneAtATime, writePrivateFile } from "#/storage/private-file.ts";

/** Where each production's cast list lives: one mutable document, no history (ADR 0010). */
export interface CastStore {
  list(productionId: string): Promise<CastList | undefined>;
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

// The stored file also remembers the next id, so a deleted member's id is never reused.
const CastFile = CastList.extend({ nextId: CastMember.shape.id.optional() });
type CastFile = ReturnType<typeof CastFile.parse>;

// The stored next id, but never one that's already taken (e.g. after a hand edit).
const nextIdOf = (file: CastFile) =>
  Math.max(file.nextId ?? 0, Math.max(0, ...file.members.map((member) => member.id)) + 1);

const listOf = ({ productionId, members }: CastFile): CastList => ({ productionId, members });

/** The file with a new member added under the next id. */
function withNewMember(file: CastFile, details: CastMemberDetails) {
  const member: CastMember = { ...details, id: nextIdOf(file), revision: 1 };
  return { member, file: { ...file, members: [...file.members, member], nextId: member.id + 1 } };
}

type Removal = { result: "removed"; file: CastFile } | { result: Refusal; file?: undefined };
type Update = { result: CastMember; file: CastFile } | { result: Refusal; file?: undefined };

/** The file with the member's details replaced (revision + 1), or why not. */
function withUpdatedMember(
  file: CastFile | undefined,
  id: number,
  revision: number,
  details: CastMemberDetails,
): Update {
  const member = file?.members.find((m) => m.id === id);
  if (!file || !member) return { result: "not-found" };
  if (member.revision !== revision) return { result: "stale" };
  const updated: CastMember = { ...details, id, revision: revision + 1 };
  return {
    result: updated,
    file: { ...file, members: file.members.map((m) => (m.id === id ? updated : m)) },
  };
}

/** The file without the member, or why not. Keeps nextId, so their id is never reused. */
function withoutMember(file: CastFile | undefined, id: number, revision: number): Removal {
  const member = file?.members.find((m) => m.id === id);
  if (!file || !member) return { result: "not-found" };
  if (member.revision !== revision) return { result: "stale" };
  return {
    result: "removed",
    file: { ...file, members: file.members.filter((m) => m.id !== id), nextId: nextIdOf(file) },
  };
}

export function inMemoryCastStore(initial: CastList[] = []): CastStore {
  const files = new Map<string, CastFile>(initial.map((list) => [list.productionId, list]));
  return {
    list: async (productionId) => {
      const file = files.get(productionId);
      return file && listOf(file);
    },
    async add(productionId, details) {
      const file = files.get(productionId);
      if (!file) return undefined;
      const added = withNewMember(file, details);
      files.set(productionId, added.file);
      return added.member;
    },
    async update(productionId, id, revision, details) {
      const updated = withUpdatedMember(files.get(productionId), id, revision, details);
      if (updated.file) files.set(productionId, updated.file);
      return updated.result;
    },
    async remove(productionId, id, revision) {
      const removed = withoutMember(files.get(productionId), id, revision);
      if (removed.file) files.set(productionId, removed.file);
      return removed.result;
    },
  };
}

// The id becomes a folder name: never trust callers to have checked it.
function castFileFor(dataDir: string, productionId: string) {
  if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
  return join(dataDir, productionId, "cast.json");
}

async function readFileOf(dataDir: string, productionId: string) {
  const text = await ifExists(() => readFile(castFileFor(dataDir, productionId), "utf8"));
  return text === undefined ? undefined : parseCastFile(text, productionId);
}

/** Local file: `<dataDir>/<productionId>/cast.json` (git-ignored). */
export function fileCastStore(dataDir: string): CastStore {
  const fileFor = (productionId: string) => castFileFor(dataDir, productionId);
  const read = (productionId: string) => readFileOf(dataDir, productionId);

  const write = (file: CastFile) =>
    writePrivateFile(fileFor(file.productionId), JSON.stringify(CastFile.parse(file), null, 2));
  const inTurn = oneAtATime();

  return {
    list: async (productionId) => {
      const file = await read(productionId);
      return file && listOf(file);
    },
    add: (productionId, details) =>
      inTurn(async () => {
        const file = await read(productionId);
        if (!file) return undefined;
        const added = withNewMember(file, details);
        await write(added.file);
        return added.member;
      }),
    update: (productionId, id, revision, details) =>
      inTurn(async () => {
        const updated = withUpdatedMember(await read(productionId), id, revision, details);
        if (updated.file) await write(updated.file);
        return updated.result;
      }),
    remove: (productionId, id, revision) =>
      inTurn(async () => {
        // The file is rewritten without them: no copy or history is kept (ADR 0010).
        const removed = withoutMember(await read(productionId), id, revision);
        if (removed.file) await write(removed.file);
        return removed.result;
      }),
  };
}

// Parse errors can quote the file, and the file holds children's names, so any problem
// becomes one fixed message with no cause attached: nothing from the file reaches a log.
function parseCastFile(text: string, productionId: string): CastFile {
  const parsed = CastFile.safeParse(parseJson(text));
  if (!parsed.success || parsed.data.productionId !== productionId) {
    throw new Error(`Cast file for production ${productionId} is invalid`);
  }
  return parsed.data;
}
