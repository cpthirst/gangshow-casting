import type { AddRoleRequest, Role, RoleList } from "@app/shared";
import { expect, it } from "vitest";
import type { RoleStore } from "./role-store.ts";

// Made-up parts only (CLAUDE.md safeguarding).
export const hook: AddRoleRequest = { name: "Captain Hook", size: "lead", castMemberIds: [] };
const smee = { name: "Mr Smee", size: "lead" as const, castMemberIds: [12] };

export const aRole = (id: number, details: Partial<Role> = {}): Role => ({
  id,
  itemId: "pirate-sketch",
  name: `Role ${id}`,
  size: "support",
  castMemberIds: [],
  revision: 1,
  ...details,
});

const roles = (list: Role[]): RoleList => ({ productionId: "2027", roles: list });

/** The added role, failing the test if the name was refused. */
export function roleFrom(result: Role | "name-taken"): Role {
  if (result === "name-taken") throw new Error("expected the role to be added");
  return result;
}

/** Two roles in Pirate Sketch, and one with the same name in another item. */
const editRoles = (): Role[] => [
  aRole(1, { name: "Captain Hook" }),
  aRole(2, { name: "Smee" }),
  aRole(3, { itemId: "campfire-song", name: "Mr Smee" }),
];

/** Roles 1 and 2 have only member 12, role 3 is an ensemble of 12 and 13, role 4 has 14. */
const castRoles = (): Role[] => [
  aRole(1, { castMemberIds: [12] }),
  aRole(2, { itemId: "campfire-song", castMemberIds: [12] }),
  aRole(3, { size: "ensemble", castMemberIds: [12, 13] }),
  aRole(4, { castMemberIds: [14] }),
];

/** The rules every role store keeps, run against each implementation. `make` starts it
 *  holding the given role lists. */
export function behavesAsARoleStore(make: (initial?: RoleList[]) => Promise<RoleStore>) {
  const byId = (list: RoleList) => [...list.roles].sort((a, b) => a.id - b.id);

  it("has no roles for a production nobody has cast yet", async () => {
    expect(await (await make()).list("2027")).toEqual({ productionId: "2027", roles: [] });
  });

  it("returns a production's roles", async () => {
    const store = await make([roles(editRoles())]);

    expect(byId(await store.list("2027"))).toEqual(editRoles());
  });

  it("adds a role to an item with the next id, revision 1 and its cast", async () => {
    const store = await make([roles([aRole(1), aRole(4)])]);

    const added = await store.add("2027", "pirate-sketch", { ...hook, castMemberIds: [12] });

    expect(added).toEqual({
      ...hook,
      castMemberIds: [12],
      id: 5,
      itemId: "pirate-sketch",
      revision: 1,
    });
    expect(byId(await store.list("2027")).at(-1)).toEqual(added);
  });

  it("keeps each production's roles apart", async () => {
    const store = await make();

    await store.add("2027", "pirate-sketch", hook);

    expect((await store.list("2028")).roles).toEqual([]);
  });

  it("gives simultaneous adds different ids and keeps both", async () => {
    const store = await make();

    const [a, b] = await Promise.all([
      store.add("2027", "pirate-sketch", hook),
      store.add("2027", "pirate-sketch", { name: "Smee", size: "support", castMemberIds: [] }),
    ]);

    expect(roleFrom(a).id).not.toBe(roleFrom(b).id);
    expect((await store.list("2027")).roles).toHaveLength(2);
  });

  it("refuses the same name in the same item, ignoring case and spaces", async () => {
    const store = await make();
    await store.add("2027", "pirate-sketch", hook);

    const again = { name: " captain HOOK ", size: "cameo" as const, castMemberIds: [] };
    expect(await store.add("2027", "pirate-sketch", again)).toBe("name-taken");
    expect((await store.list("2027")).roles).toHaveLength(1);
  });

  it("allows the same name in a different item", async () => {
    const store = await make();
    const narrator = { name: "Narrator", size: "support" as const, castMemberIds: [] };
    await store.add("2027", "pirate-sketch", narrator);

    const added = await store.add("2027", "campfire-song", narrator);

    expect(added).toMatchObject({ itemId: "campfire-song", name: "Narrator" });
  });

  it("lets only one of two simultaneous adds of the same name through", async () => {
    const store = await make();

    const results = await Promise.all([
      store.add("2027", "pirate-sketch", hook),
      store.add("2027", "pirate-sketch", hook),
    ]);

    expect(results.filter((result) => result === "name-taken")).toHaveLength(1);
    expect((await store.list("2027")).roles).toHaveLength(1);
  });

  it("updates a role at the given revision, bumping the revision", async () => {
    const store = await make([roles(editRoles())]);

    const result = await store.update("2027", 2, 1, smee);

    expect(result).toEqual({ ...smee, id: 2, itemId: "pirate-sketch", revision: 2 });
    expect((await store.list("2027")).roles.find((role) => role.id === 2)).toEqual(result);
  });

  it("refuses a stale revision or an unknown role, changing nothing", async () => {
    const store = await make([roles(editRoles())]);

    expect(await store.update("2027", 2, 9, smee)).toBe("stale");
    expect(await store.update("2027", 99, 1, smee)).toBe("not-found");
    expect(byId(await store.list("2027"))).toEqual(editRoles());
  });

  it("refuses a name another role in the item uses, ignoring case", async () => {
    const store = await make([roles(editRoles())]);

    expect(await store.update("2027", 2, 1, { ...smee, name: "captain hook" })).toBe("name-taken");
    expect(byId(await store.list("2027"))).toEqual(editRoles());
  });

  it("lets a role keep its own name", async () => {
    const store = await make([roles(editRoles())]);

    const result = await store.update("2027", 1, 1, { ...smee, name: "CAPTAIN HOOK" });

    expect(result).toMatchObject({ id: 1, name: "CAPTAIN HOOK" });
  });

  it("frees a role's old name when it's renamed", async () => {
    const store = await make([roles(editRoles())]);

    await store.update("2027", 1, 1, { ...hook, name: "Skipper" });

    expect(await store.add("2027", "pirate-sketch", hook)).toMatchObject({ name: "Captain Hook" });
  });

  it("removes a role at the given revision, keeping the others", async () => {
    const store = await make([roles(editRoles())]);

    expect(await store.remove("2027", 2, 1)).toBe("removed");
    expect(byId(await store.list("2027")).map((role) => role.id)).toEqual([1, 3]);
  });

  it("refuses a stale revision or an unknown role, removing nothing", async () => {
    const store = await make([roles(editRoles())]);

    expect(await store.remove("2027", 2, 9)).toBe("stale");
    expect(await store.remove("2027", 99, 1)).toBe("not-found");
    expect(byId(await store.list("2027"))).toEqual(editRoles());
  });

  it("frees a removed role's name, but never gives its id to a new one", async () => {
    const store = await make([roles(editRoles())]);

    await store.remove("2027", 3, 1);
    const added = roleFrom(
      await store.add("2027", "campfire-song", { ...smee, castMemberIds: [] }),
    );

    expect(added.id).toBe(4);
  });

  it("takes an uncast member out of every role, keeping the roles and everyone else", async () => {
    const store = await make([roles(castRoles())]);

    await store.uncastMember("2027", 12);

    const castOf = (id: number) => byId(list).find((role) => role.id === id)?.castMemberIds;
    const list = await store.list("2027");
    expect([castOf(1), castOf(2), castOf(3), castOf(4)]).toEqual([[], [], [13], [14]]);
  });

  it("bumps the revision of each role uncasting changes, and only those", async () => {
    const store = await make([roles(castRoles())]);

    await store.uncastMember("2027", 12);

    expect(byId(await store.list("2027")).map((role) => role.revision)).toEqual([2, 2, 2, 1]);
  });
}
