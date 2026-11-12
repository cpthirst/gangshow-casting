import { type AddRoleRequest, Role, RoleList, sameRoleName } from "@app/shared";
import {
  type Change,
  documentsInFiles,
  documentsInMemory,
  keepOnlyRowsOfItems,
  type ProductionDocuments,
  saveRevised,
} from "#/storage/production-documents.ts";

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
  /** Removes every role of every item not in `itemIds`, with who was cast in them: nothing
   *  about an item that has left the show is kept (running-order E3.S2). */
  keepOnlyItems(productionId: string, itemIds: string[]): Promise<void>;
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
function withNewRole(
  file: RoleFile,
  itemId: string,
  details: AddRoleRequest,
): Change<RoleFile, Role | "name-taken"> {
  const taken = file.roles.some((r) => r.itemId === itemId && sameRoleName(r.name, details.name));
  if (taken) return { answer: "name-taken" };
  const role: Role = { ...details, id: nextIdOf(file), itemId, revision: 1 };
  return { answer: role, save: { ...file, roles: [...file.roles, role], nextId: role.id + 1 } };
}

/** The file with one role's details replaced, or why not. */
function withUpdatedRole(
  file: RoleFile,
  id: number,
  revision: number,
  details: AddRoleRequest,
): Change<RoleFile, Role | RoleRefusal> {
  const role = file.roles.find((r) => r.id === id);
  if (!role) return { answer: "not-found" };
  if (role.revision !== revision) return { answer: "stale" };
  const taken = file.roles.some(
    (r) => r.id !== id && r.itemId === role.itemId && sameRoleName(r.name, details.name),
  );
  if (taken) return { answer: "name-taken" };
  const updated: Role = { ...role, ...details, revision: revision + 1 };
  return {
    answer: updated,
    save: { ...file, roles: file.roles.map((r) => (r.id === id ? updated : r)) },
  };
}

/** The file without the role, or why not. Keeps nextId, so its id is never reused. */
function withoutRole(
  file: RoleFile,
  id: number,
  revision: number,
): Change<RoleFile, "removed" | "not-found" | "stale"> {
  const role = file.roles.find((r) => r.id === id);
  if (!role) return { answer: "not-found" };
  if (role.revision !== revision) return { answer: "stale" };
  // nextId is worked out before filtering, so the removed id stays taken.
  return {
    answer: "removed",
    save: { ...file, roles: file.roles.filter((r) => r.id !== id), nextId: nextIdOf(file) },
  };
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

/** The file with only the roles given. Keeps nextId, so the others' ids are never reused. */
const withOnly = (file: RoleFile, roles: Role[]): RoleFile => ({
  ...file,
  roles,
  nextId: nextIdOf(file),
});

/** A role store's rules, wherever its files are kept. */
function roleStoreOver(files: ProductionDocuments<RoleFile>): RoleStore {
  return {
    list: async (productionId) => listOf(await files.read(productionId)),
    // Checked and saved in one turn, so two adds of the same name can't both succeed.
    add: (productionId, itemId, details) =>
      files.change(productionId, (file) => withNewRole(file, itemId, details)),
    update: (productionId, id, revision, details) =>
      files.change(productionId, (file) => withUpdatedRole(file, id, revision, details)),
    // The file is rewritten without it: no copy or history is kept (ADR 0010).
    remove: (productionId, id, revision) =>
      files.change(productionId, (file) => withoutRole(file, id, revision)),
    uncastMember: (productionId, castMemberId) =>
      // Nothing to save if they're in no roles (e.g. no roles file yet).
      saveRevised(files, productionId, (file) =>
        file.roles.some((role) => role.castMemberIds.includes(castMemberId))
          ? withoutMember(file, castMemberId)
          : undefined,
      ),
    keepOnlyItems: (productionId, itemIds) =>
      keepOnlyRowsOfItems(files, productionId, itemIds, (file) => file.roles, withOnly),
  };
}

export const inMemoryRoleStore = (initial: RoleList[] = []) =>
  roleStoreOver(documentsInMemory<RoleFile>(initial, emptyFile));

/** Local file: `<dataDir>/<productionId>/roles.json` (git-ignored), created with the first role. */
export const fileRoleStore = (dataDir: string) =>
  roleStoreOver(
    documentsInFiles({
      dataDir,
      fileName: "roles.json",
      label: "Roles",
      schema: RoleFile,
      empty: emptyFile,
    }),
  );
