import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CastList, CastMember, type CastMemberDetails, ProductionId } from "@app/shared";
import { ifExists } from "./files.ts";
import { parseJson } from "./json.ts";

/** Where each production's cast list lives: one mutable document, no history (ADR 0010). */
export interface CastStore {
  list(productionId: string): Promise<CastList | undefined>;
  /** Adds a member with the next unused id; undefined if the production has no cast list. */
  add(productionId: string, details: CastMemberDetails): Promise<CastMember | undefined>;
  /** Removes a member for good, if they're still at the given revision. */
  remove(productionId: string, id: number, revision: number): Promise<RemoveResult>;
}

export type RemoveResult = "removed" | "stale" | "not-found";

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

type Removal =
  | { result: "removed"; file: CastFile }
  | { result: "stale" | "not-found"; file?: undefined };

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
    async remove(productionId, id, revision) {
      const removed = withoutMember(files.get(productionId), id, revision);
      if (removed.file) files.set(productionId, removed.file);
      return removed.result;
    },
  };
}

/** Local file: `<dataDir>/<productionId>/cast.json` (git-ignored). */
export function fileCastStore(dataDir: string): CastStore {
  // The id becomes a folder name: never trust callers to have checked it.
  const fileFor = (productionId: string) => {
    if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
    return join(dataDir, productionId, "cast.json");
  };

  async function read(productionId: string) {
    const text = await ifExists(() => readFile(fileFor(productionId), "utf8"));
    return text === undefined ? undefined : parseCastFile(text, productionId);
  }

  // Write the whole file to a temp file, then rename it into place: a crash never
  // leaves a half-written cast list.
  async function write(file: CastFile) {
    const path = fileFor(file.productionId);
    const temp = join(dirname(path), `.cast-${randomUUID()}.tmp`);
    await mkdir(dirname(path), { recursive: true });
    try {
      // Owner-only: the file holds children's names.
      await writeFile(temp, JSON.stringify(CastFile.parse(file), null, 2), { mode: 0o600 });
      await rename(temp, path);
    } finally {
      await rm(temp, { force: true });
    }
  }

  // One change at a time, so two simultaneous saves can't overwrite each other. This only
  // holds within one process (the dev server); a hosted store needs its own guarantee.
  let queue: Promise<unknown> = Promise.resolve();
  const oneAtATime = <T>(change: () => Promise<T>): Promise<T> => {
    const result = queue.then(change);
    queue = result.catch(() => undefined);
    return result;
  };

  return {
    list: async (productionId) => {
      const file = await read(productionId);
      return file && listOf(file);
    },
    add: (productionId, details) =>
      oneAtATime(async () => {
        const file = await read(productionId);
        if (!file) return undefined;
        const added = withNewMember(file, details);
        await write(added.file);
        return added.member;
      }),
    remove: (productionId, id, revision) =>
      oneAtATime(async () => {
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
