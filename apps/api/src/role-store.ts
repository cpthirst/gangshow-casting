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
  /** Takes a cast member out of every role (e.g. they've left the cast). The roles stay. */
  uncastMember(productionId: string, castMemberId: number): Promise<void>;
}

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
    async uncastMember(productionId, castMemberId) {
      files.set(productionId, withoutMember(fileOf(productionId), castMemberId));
    },
  };
}

/** Local file: `<dataDir>/<productionId>/roles.json` (git-ignored), created with the first role. */
export function fileRoleStore(dataDir: string): RoleStore {
  // The id becomes a folder name: never trust callers to have checked it.
  const fileFor = (productionId: string) => {
    if (!ProductionId.safeParse(productionId).success) throw new Error("Invalid production id");
    return join(dataDir, productionId, "roles.json");
  };

  async function read(productionId: string) {
    const text = await ifExists(() => readFile(fileFor(productionId), "utf8"));
    return text === undefined ? emptyFile(productionId) : parseRoleFile(text, productionId);
  }

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
