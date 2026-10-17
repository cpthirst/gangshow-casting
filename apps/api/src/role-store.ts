import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type AddRoleRequest, ProductionId, Role, RoleList, sameRoleName } from "@app/shared";
import { ifExists } from "./files.ts";
import { parseJson } from "./json.ts";
import { oneAtATime, writePrivateFile } from "./private-file.ts";

/** Where each production's roles live: one mutable document, no history (ADR 0010). */
export interface RoleStore {
  /** Every role in the production; none until the first is added. */
  list(productionId: string): Promise<RoleList>;
  /** Adds a role to an item, with the next unused id, unless the item already has a role
   *  with that name. */
  add(productionId: string, itemId: string, details: AddRoleRequest): Promise<Role | "name-taken">;
  /** Replaces a role's details (revision + 1), if it's still at the given revision and no
   *  other role in its item has the new name. */
  update(
    productionId: string,
    id: number,
    revision: number,
    details: AddRoleRequest,
  ): Promise<Role | RoleRefusal>;
  /** Removes a role for good, with who was cast in it, if it's still at the given revision. */
  remove(
    productionId: string,
    id: number,
    revision: number,
  ): Promise<"removed" | Exclude<RoleRefusal, "name-taken">>;
  /** Takes a cast member out of every role (e.g. they've left the cast). The roles stay. */
  uncastMember(productionId: string, castMemberId: number): Promise<void>;
}

/** Why a change to one role was refused: it's gone, someone else changed it first, or
 *  another role in the item already has the name. */
export type RoleRefusal = "not-found" | "stale" | "name-taken";

// The stored file also remembers the next id, so a removed role's id is never reused.
const RoleFile = RoleList.extend({ nextId: Role.shape.id.optional() });
type RoleFile = ReturnType<typeof RoleFile.parse>;

const emptyFile = (productionId: string): RoleFile => ({ productionId, roles: [] });

// The stored next id, but never one that's already taken (e.g. after a hand edit).
const nextIdOf = (file: RoleFile) =>
  Math.max(file.nextId ?? 0, Math.max(0, ...file.roles.map((role) => role.id)) + 1);

const listOf = ({ productionId, roles }: RoleFile): RoleList => ({ productionId, roles });

/** The file with a new role added to the item under the next id, or why not. */
function withNewRole(file: RoleFile, itemId: string, details: AddRoleRequest) {
  const taken = file.roles.some((r) => r.itemId === itemId && sameRoleName(r.name, details.name));
  if (taken) return "name-taken";
  const role: Role = { ...details, id: nextIdOf(file), itemId, revision: 1 };
  return { role, file: { ...file, roles: [...file.roles, role], nextId: role.id + 1 } };
}

/** The file with one role's details replaced, or why not. */
function withUpdatedRole(file: RoleFile, id: number, revision: number, details: AddRoleRequest) {
  const role = file.roles.find((r) => r.id === id);
  if (!role) return "not-found";
  if (role.revision !== revision) return "stale";
  const taken = file.roles.some(
    (r) => r.id !== id && r.itemId === role.itemId && sameRoleName(r.name, details.name),
  );
  if (taken) return "name-taken";
  const updated: Role = { ...role, ...details, revision: revision + 1 };
  return {
    role: updated,
    file: { ...file, roles: file.roles.map((r) => (r.id === id ? updated : r)) },
  };
}

/** The file without the role, or why not. Keeps nextId, so its id is never reused. */
function withoutRole(file: RoleFile, id: number, revision: number) {
  const role = file.roles.find((r) => r.id === id);
  if (!role) return "not-found";
  if (role.revision !== revision) return "stale";
  // nextId is worked out before filtering, so the removed id stays taken.
  return { ...file, roles: file.roles.filter((r) => r.id !== id), nextId: nextIdOf(file) };
}

/** The file with the member taken out of every role; each role that changes is bumped. */
function withoutMember(file: RoleFile, castMemberId: number): RoleFile {
  const roles = file.roles.map((role) =>
    role.castMemberIds.includes(castMemberId)
      ? {
          ...role,
          castMemberIds: role.castMemberIds.filter((id) => id !== castMemberId),
          revision: role.revision + 1,
        }
      : role,
  );
  return { ...file, roles };
}

export function inMemoryRoleStore(initial: RoleList[] = []): RoleStore {
  const files = new Map<string, RoleFile>(initial.map((list) => [list.productionId, list]));
  const fileOf = (productionId: string) => files.get(productionId) ?? emptyFile(productionId);
  return {
    list: async (productionId) => listOf(fileOf(productionId)),
    async add(productionId, itemId, details) {
      const added = withNewRole(fileOf(productionId), itemId, details);
      if (added === "name-taken") return added;
      files.set(productionId, added.file);
      return added.role;
    },
    async update(productionId, id, revision, details) {
      const updated = withUpdatedRole(fileOf(productionId), id, revision, details);
      if (typeof updated === "string") return updated;
      files.set(productionId, updated.file);
      return updated.role;
    },
    async remove(productionId, id, revision) {
      const removed = withoutRole(fileOf(productionId), id, revision);
      if (typeof removed === "string") return removed;
      files.set(productionId, removed);
      return "removed";
    },
    async uncastMember(productionId, castMemberId) {
      files.set(productionId, withoutMember(fileOf(productionId), castMemberId));
    },
  };
}

// The id becomes a folder name: never trust callers to have checked it.
function roleFileFor(dataDir: string, productionId: string) {
  if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
  return join(dataDir, productionId, "roles.json");
}

async function readFileOf(dataDir: string, productionId: string) {
  const text = await ifExists(() => readFile(roleFileFor(dataDir, productionId), "utf8"));
  return text === undefined ? emptyFile(productionId) : parseRoleFile(text, productionId);
}

/** A production's roles as stored, with the next id it would hand out, for copying them
 *  elsewhere (remote-data FR8). */
export async function readRoleFile(dataDir: string, productionId: string) {
  const file = await readFileOf(dataDir, productionId);
  return { list: listOf(file), nextId: nextIdOf(file) };
}

/** Local file: `<dataDir>/<productionId>/roles.json` (git-ignored), created with the first role. */
export function fileRoleStore(dataDir: string): RoleStore {
  const fileFor = (productionId: string) => roleFileFor(dataDir, productionId);
  const read = (productionId: string) => readFileOf(dataDir, productionId);

  const write = (file: RoleFile) =>
    writePrivateFile(fileFor(file.productionId), JSON.stringify(RoleFile.parse(file), null, 2));
  const inTurn = oneAtATime();

  return {
    list: async (productionId) => listOf(await read(productionId)),
    add: (productionId, itemId, details) =>
      // Checked and saved in one turn, so two adds of the same name can't both succeed.
      inTurn(async () => {
        const added = withNewRole(await read(productionId), itemId, details);
        if (added === "name-taken") return added;
        await write(added.file);
        return added.role;
      }),
    update: (productionId, id, revision, details) =>
      inTurn(async () => {
        const updated = withUpdatedRole(await read(productionId), id, revision, details);
        if (typeof updated === "string") return updated;
        await write(updated.file);
        return updated.role;
      }),
    remove: (productionId, id, revision) =>
      inTurn(async () => {
        // The file is rewritten without it: no copy or history is kept (ADR 0010).
        const removed = withoutRole(await read(productionId), id, revision);
        if (typeof removed === "string") return removed;
        await write(removed);
        return "removed";
      }),
    uncastMember: (productionId, castMemberId) =>
      inTurn(async () => {
        const file = await read(productionId);
        // Nothing to save if they're in no roles (e.g. no roles file yet).
        if (!file.roles.some((role) => role.castMemberIds.includes(castMemberId))) return;
        await write(withoutMember(file, castMemberId));
      }),
  };
}

// Roles link children to parts, so a parse error (which can quote the file) becomes one
// fixed message with nothing from the file in it.
function parseRoleFile(text: string, productionId: string): RoleFile {
  const parsed = RoleFile.safeParse(parseJson(text));
  if (!parsed.success || parsed.data.productionId !== productionId) {
    throw new Error(`Roles file for production ${productionId} is invalid`);
  }
  return parsed.data;
}
