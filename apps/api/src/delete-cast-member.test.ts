import type { Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { inMemoryCastStore } from "./cast-store.ts";
import { createDeleteCastMember } from "./delete-cast-member.ts";
import { uncastThenRemove } from "./remove-cast-member.ts";
import { inMemoryRoleStore, type RoleStore } from "./role-store.ts";

const request = (castId: string, revision: string | undefined, productionId = "2027") => ({
  pathParameters: { productionId, castId },
  ...(revision === undefined ? {} : { queryStringParameters: { revision } }),
});

const aRole = (id: number, itemId: string, castMemberIds: number[]): Role => ({
  id,
  itemId,
  name: `Role ${id}`,
  size: castMemberIds.length > 1 ? "ensemble" : "lead",
  castMemberIds,
  revision: 1,
});

function setUp(roles: RoleStore = inMemoryRoleStore()) {
  const store = inMemoryCastStore([aCastList([aCastMember(1), aCastMember(12, { revision: 4 })])]);
  return { store, roles, handler: createDeleteCastMember(uncastThenRemove(store, roles)) };
}

const ids = async (store: ReturnType<typeof setUp>["store"]) =>
  (await store.list("2027"))?.members.map((m) => m.id);

describe("delete cast member handler", () => {
  it("returns 204 and removes the member", async () => {
    const { store, handler } = setUp();

    const res = await handler(request("12", "4"));

    expect(res.statusCode).toBe(204);
    expect(res.body).toBeUndefined();
    expect(await ids(store)).toEqual([1]);
  });

  it("returns 409 for a stale revision, removing nothing", async () => {
    const { store, handler } = setUp();

    expect((await handler(request("12", "3"))).statusCode).toBe(409);
    expect(await ids(store)).toEqual([1, 12]);
  });

  it.each([
    ["an unknown member", request("99", "1")],
    ["a production with no cast list", request("12", "4", "1999")],
    ["a malformed production id", request("12", "4", "../etc")],
  ])("returns 404 for %s, removing nothing", async (_case, event) => {
    const { store, handler } = setUp();

    expect((await handler(event)).statusCode).toBe(404);
    expect(await ids(store)).toEqual([1, 12]);
  });

  it.each([
    ["no revision", request("12", undefined)],
    ["a non-numeric revision", request("12", "four")],
    ["a non-numeric cast id", request("twelve", "4")],
  ])("returns 400 for %s, removing nothing", async (_case, event) => {
    const { store, handler } = setUp();

    expect((await handler(event)).statusCode).toBe(400);
    expect(await ids(store)).toEqual([1, 12]);
  });
});

describe("delete cast member handler with roles", () => {
  const rolesWith12 = () =>
    inMemoryRoleStore([
      {
        productionId: "2027",
        roles: [
          aRole(7, "pirate-sketch", [12]),
          aRole(8, "campfire-song", [12]),
          aRole(9, "pirate-sketch", [12, 1]),
        ],
      },
    ]);

  it("leaves no reference to the member in any stored role", async () => {
    const { roles, handler } = setUp(rolesWith12());

    const res = await handler(request("12", "4"));

    expect(res.statusCode).toBe(204);
    expect(JSON.stringify(await roles.list("2027"))).not.toMatch(/\b12\b/);
  });

  it("uncasts their single-person roles and keeps the others in an ensemble", async () => {
    const { roles, handler } = setUp(rolesWith12());

    await handler(request("12", "4"));

    const cast = (await roles.list("2027")).roles.map((role) => [role.id, role.castMemberIds]);
    expect(cast).toEqual([
      [7, []],
      [8, []],
      [9, [1]],
    ]);
  });

  it("changes no roles when the delete is stale or the member unknown", async () => {
    const { roles, handler } = setUp(rolesWith12());

    expect((await handler(request("12", "3"))).statusCode).toBe(409);
    expect((await handler(request("99", "1"))).statusCode).toBe(404);
    expect((await roles.list("2027")).roles.every((role) => role.revision === 1)).toBe(true);
  });

  it("also clears a role they were cast in while the delete was under way", async () => {
    const roles = rolesWith12();
    const cast = inMemoryCastStore([aCastList([aCastMember(1), aCastMember(12, { revision: 4 })])]);
    // Someone casts member 12 in a new role between the roles being cleared and the delete.
    const racingCast = {
      ...cast,
      remove: async (productionId: string, id: number, revision: number) => {
        await roles.add(productionId, "pirate-sketch", {
          name: "Late Addition",
          size: "lead",
          castMemberIds: [12],
        });
        return cast.remove(productionId, id, revision);
      },
    };

    await createDeleteCastMember(uncastThenRemove(racingCast, roles))(request("12", "4"));

    expect(JSON.stringify(await roles.list("2027"))).not.toMatch(/"castMemberIds":\[[^\]]*\b12\b/);
  });

  it("rejects, leaving the member on the cast list, if their roles can't be saved", async () => {
    const failingRoles: RoleStore = {
      ...inMemoryRoleStore(),
      uncastMember: async () => {
        throw new Error("disk full");
      },
    };
    const { store, handler } = setUp(failingRoles);

    await expect(handler(request("12", "4"))).rejects.toThrow();
    expect(await ids(store)).toEqual([1, 12]);
  });
});
