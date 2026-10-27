import type { Role, RoleList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { inMemoryPropStore } from "./prop-store.ts";
import { createRemoveRole } from "./remove-role.ts";
import { inMemoryRoleStore } from "./role-store.ts";

const request = (roleId: string, revision: string | undefined, productionId = "2027") => ({
  pathParameters: { productionId, roleId },
  ...(revision === undefined ? {} : { queryStringParameters: { revision } }),
});

const role = (id: number, revision: number, castMemberIds: number[] = []): Role => ({
  id,
  itemId: "pirate-sketch",
  name: `Role ${id}`,
  size: "cameo",
  castMemberIds,
  revision,
});

function setUp() {
  const initial: RoleList = { productionId: "2027", roles: [role(6, 1), role(7, 2, [12])] };
  const roles = inMemoryRoleStore([initial]);
  return { roles, initial, handler: createRemoveRole(roles, inMemoryPropStore()) };
}

describe("remove role handler", () => {
  it("returns 204 and removes the role and its casting", async () => {
    const { roles, handler } = setUp();

    const res = await handler(request("7", "2"));

    expect(res.statusCode).toBe(204);
    const stored = await roles.list("2027");
    expect(stored.roles.map((r) => r.id)).toEqual([6]);
    expect(stored.roles.some((r) => r.castMemberIds.includes(12))).toBe(false);
  });

  it.each([
    ["a stale revision", request("7", "1"), 409],
    ["a role that doesn't exist", request("99", "1"), 404],
  ])("refuses %s, removing nothing", async (_case, event, status) => {
    const { roles, initial, handler } = setUp();

    expect((await handler(event)).statusCode).toBe(status);
    expect(await roles.list("2027")).toEqual(initial);
  });

  it.each([
    ["no revision", request("7", undefined)],
    ["a revision that isn't a number", request("7", "two")],
  ])("refuses %s with 400", async (_case, event) => {
    const { handler } = setUp();

    expect((await handler(event)).statusCode).toBe(400);
  });

  it("returns 404 for an invalid production id or role id", async () => {
    const { handler } = setUp();

    expect((await handler(request("7", "2", "../etc"))).statusCode).toBe(404);
    expect((await handler(request("abc", "2"))).statusCode).toBe(404);
  });
});

describe("remove role handler with props", () => {
  // Made-up cast: Jo (3) is a villager (role 6), Sam (1) one of the crowd (role 7).
  function setUpLantern() {
    const ensemble = (id: number, castMemberIds: number[]): Role => ({
      ...role(id, 1, castMemberIds),
      size: "ensemble",
    });
    const roles = inMemoryRoleStore([
      { productionId: "2027", roles: [ensemble(6, [3]), ensemble(7, [1])] },
    ]);
    const lantern = {
      id: 1,
      itemId: "pirate-sketch",
      name: "Lantern",
      quantity: 2,
      roleIds: [6, 7],
      carrierIds: [3, 1],
    };
    const props = inMemoryPropStore([{ productionId: "2027", props: [lantern] }]);
    return { props, handler: createRemoveRole(roles, props) };
  }
  const carriers = async (props: ReturnType<typeof setUpLantern>["props"]) =>
    (await props.list("2027")).props[0]?.carrierIds;

  it("takes the role's carriers off a prop that's linked to it", async () => {
    const { props, handler } = setUpLantern();

    expect((await handler(request("7", "1"))).statusCode).toBe(204);

    expect(await carriers(props)).toEqual([3]);
  });

  it("changes no props when the removal is refused", async () => {
    const { props, handler } = setUpLantern();

    expect((await handler(request("7", "5"))).statusCode).toBe(409);

    expect(await carriers(props)).toEqual([3, 1]);
  });
});
