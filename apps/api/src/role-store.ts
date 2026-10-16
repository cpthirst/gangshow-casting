import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type AddRoleRequest, ProductionId, Role, RoleList } from "@app/shared";
import { ifExists } from "./files.ts";
import { parseJson } from "./json.ts";
import { oneAtATime, writePrivateFile } from "./private-file.ts";

/** Where each production's roles live: one mutable document, no history (ADR 0010). */
export interface RoleStore {
  /** Every role in the production; none until the first is added. */
  list(productionId: string): Promise<RoleList>;
  /** Adds an uncast role to an item, with the next unused id. */
  add(productionId: string, itemId: string, details: AddRoleRequest): Promise<Role>;
}

// The stored file also remembers the next id, so a removed role's id is never reused.
const RoleFile = RoleList.extend({ nextId: Role.shape.id.optional() });
type RoleFile = ReturnType<typeof RoleFile.parse>;

const emptyFile = (productionId: string): RoleFile => ({ productionId, roles: [] });

// The stored next id, but never one that's already taken (e.g. after a hand edit).
const nextIdOf = (file: RoleFile) =>
  Math.max(file.nextId ?? 0, Math.max(0, ...file.roles.map((role) => role.id)) + 1);

const listOf = ({ productionId, roles }: RoleFile): RoleList => ({ productionId, roles });

/** The file with a new, uncast role added to the item under the next id. */
function withNewRole(file: RoleFile, itemId: string, details: AddRoleRequest) {
  const role: Role = { ...details, id: nextIdOf(file), itemId, castMemberIds: [], revision: 1 };
  return { role, file: { ...file, roles: [...file.roles, role], nextId: role.id + 1 } };
}

export function inMemoryRoleStore(initial: RoleList[] = []): RoleStore {
  const files = new Map<string, RoleFile>(initial.map((list) => [list.productionId, list]));
  const fileOf = (productionId: string) => files.get(productionId) ?? emptyFile(productionId);
  return {
    list: async (productionId) => listOf(fileOf(productionId)),
    async add(productionId, itemId, details) {
      const added = withNewRole(fileOf(productionId), itemId, details);
      files.set(productionId, added.file);
      return added.role;
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
      inTurn(async () => {
        const added = withNewRole(await read(productionId), itemId, details);
        await write(added.file);
        return added.role;
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
