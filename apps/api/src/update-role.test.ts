import { AddRoleRefusal, Role, type RoleList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { inMemoryCastStore } from "./cast-store.ts";
import { inMemoryPropStore } from "./prop-store.ts";
import { inMemoryRoleStore } from "./role-store.ts";
import { createUpdateRole } from "./update-role.ts";

const request = (roleId: string, body: unknown, productionId = "2027") => ({
  pathParameters: { productionId, roleId },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

const role = (id: number, name: string, revision = 1): Role => ({
  id,
  itemId: "pirate-sketch",
  name,
  size: "support",
  castMemberIds: [],
  revision,
});

function setUp() {
  const initial: RoleList = {
    productionId: "2027",
    roles: [role(6, "Captain Hook"), role(7, "Smee", 2)],
  };
  const roles = inMemoryRoleStore([initial]);
  const cast = inMemoryCastStore([aCastList([aCastMember(12), aCastMember(13)])]);
  return { roles, initial, handler: createUpdateRole(roles, cast, inMemoryPropStore()) };
}

const mrSmee = { name: "Mr Smee", size: "lead", castMemberIds: [12], revision: 2 };

describe("update role handler", () => {
  it("returns 200 with the updated role at the next revision", async () => {
    const { roles, handler } = setUp();

    const res = await handler(request("7", mrSmee));

    expect(res.statusCode).toBe(200);
    expect(Role.parse(JSON.parse(res.body ?? ""))).toEqual({
      id: 7,
      itemId: "pirate-sketch",
      name: "Mr Smee",
      size: "lead",
      castMemberIds: [12],
      revision: 3,
    });
    expect((await roles.list("2027")).roles.find((r) => r.id === 7)?.name).toBe("Mr Smee");
  });

  it.each([
    ["a stale revision", "7", { ...mrSmee, revision: 1 }, 409],
    ["a role that doesn't exist", "99", mrSmee, 404],
  ])("refuses %s, changing nothing", async (_case, roleId, body, status) => {
    const { roles, initial, handler } = setUp();

    expect((await handler(request(roleId, body))).statusCode).toBe(status);
    expect(await roles.list("2027")).toEqual(initial);
  });

  it.each([
    ["no name", { ...mrSmee, name: "" }],
    ["two people in a lead role", { ...mrSmee, castMemberIds: [12, 13] }],
    ["an unknown cast member", { ...mrSmee, castMemberIds: [99] }],
    ["an id in the body", { ...mrSmee, id: 7 }],
    ["malformed JSON", "{not json"],
  ])("refuses %s with 400, changing nothing", async (_case, body) => {
    const { roles, initial, handler } = setUp();

    expect((await handler(request("7", body))).statusCode).toBe(400);
    expect(await roles.list("2027")).toEqual(initial);
  });

  it("refuses a name another role in the item uses with 400 and name-taken", async () => {
    const { roles, initial, handler } = setUp();

    const res = await handler(request("7", { ...mrSmee, name: "captain hook" }));

    expect(res.statusCode).toBe(400);
    expect(AddRoleRefusal.parse(JSON.parse(res.body ?? ""))).toEqual({ error: "name-taken" });
    expect(await roles.list("2027")).toEqual(initial);
  });

  it("returns 404 for an invalid production id or role id", async () => {
    const { handler } = setUp();

    expect((await handler(request("7", mrSmee, "../etc"))).statusCode).toBe(404);
    expect((await handler(request("abc", mrSmee))).statusCode).toBe(404);
  });
});

describe("update role handler for ensembles", () => {
  const pirates = (castMemberIds: number[]): RoleList => ({
    productionId: "2027",
    roles: [{ ...role(9, "Pirates"), size: "ensemble", castMemberIds }],
  });
  const handlerFor = (initial: RoleList) => {
    const roles = inMemoryRoleStore([initial]);
    const cast = inMemoryCastStore([aCastList([aCastMember(12), aCastMember(13)])]);
    return { roles, handler: createUpdateRole(roles, cast, inMemoryPropStore()) };
  };

  it("refuses the same member twice, changing nothing", async () => {
    const { roles, handler } = handlerFor(pirates([12]));
    const body = { name: "Pirates", size: "ensemble", castMemberIds: [12, 12], revision: 1 };

    expect((await handler(request("9", body))).statusCode).toBe(400);
    expect(await roles.list("2027")).toEqual(pirates([12]));
  });

  it("refuses narrowing an ensemble that has several people, changing nothing", async () => {
    const { roles, handler } = handlerFor(pirates([12, 13]));
    const body = { name: "Pirates", size: "cameo", castMemberIds: [12, 13], revision: 1 };

    expect((await handler(request("9", body))).statusCode).toBe(400);
    expect(await roles.list("2027")).toEqual(pirates([12, 13]));
  });
});

describe("update role handler with props", () => {
  // Made-up cast: Jo (12) and Kim (13) are villagers; Kim carries the bread basket.
  const villagers: Role = { ...role(9, "Villagers"), size: "ensemble", castMemberIds: [12, 13] };
  const basket = {
    id: 1,
    itemId: "pirate-sketch",
    name: "Bread basket",
    quantity: 1,
    roleIds: [villagers.id],
    carrierIds: [13],
  };
  function setUpVillage() {
    const roles = inMemoryRoleStore([{ productionId: "2027", roles: [villagers] }]);
    const cast = inMemoryCastStore([aCastList([aCastMember(12), aCastMember(13)])]);
    const props = inMemoryPropStore([{ productionId: "2027", props: [basket] }]);
    return { props, handler: createUpdateRole(roles, cast, props) };
  }
  const recast = (castMemberIds: number[], revision: number) =>
    request("9", { name: "Villagers", size: "ensemble", castMemberIds, revision });
  const carriers = async (props: ReturnType<typeof setUpVillage>["props"]) =>
    (await props.list("2027")).props[0]?.carrierIds;

  it("takes a carrier off a prop when they're taken out of its role", async () => {
    const { props, handler } = setUpVillage();

    expect((await handler(recast([12], 1))).statusCode).toBe(200);

    expect(await carriers(props)).toEqual([]);
  });

  it("leaves the carriers alone when they still play the role", async () => {
    const { props, handler } = setUpVillage();

    await handler(recast([13], 1));

    expect(await carriers(props)).toEqual([13]);
  });

  it("doesn't make someone a carrier again when they're put back in the role", async () => {
    const { props, handler } = setUpVillage();

    await handler(recast([12], 1));
    await handler(recast([12, 13], 2));

    expect(await carriers(props)).toEqual([]);
  });

  it("changes no props when the recast is refused", async () => {
    const { props, handler } = setUpVillage();

    expect((await handler(recast([12], 5))).statusCode).toBe(409);

    expect(await carriers(props)).toEqual([13]);
  });
});
