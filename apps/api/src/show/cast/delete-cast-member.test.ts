import type { Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import { inMemoryRoleStore, type RoleStore } from "#/casting/roles/role-store.ts";
import { aCostume } from "#/production/costumes/costume-store.contract.ts";
import { inMemoryCostumeStore } from "#/production/costumes/costume-store.ts";
import { inMemoryMicPlotStore } from "#/production/mic-plot/mic-plot-store.ts";
import { inMemoryPropStore, type PropStore } from "#/production/props/prop-store.ts";
import type { Stores } from "#/storage/data-stores.ts";
import { inMemoryStores } from "#/storage/stores.fixture.ts";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { inMemoryCastStore } from "./cast-store.ts";
import { createDeleteCastMember } from "./delete-cast-member.ts";

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

/** The handler as routes.ts builds it, from the stores given. */
const deleteWith = (stores: Stores) =>
  createDeleteCastMember(stores.removeCastMember, stores.roles, stores);

function setUp(roles: RoleStore = inMemoryRoleStore(), props: PropStore = inMemoryPropStore()) {
  const store = inMemoryCastStore([aCastList([aCastMember(1), aCastMember(12, { revision: 4 })])]);
  return { store, roles, handler: deleteWith(inMemoryStores({ cast: store, roles, props })) };
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

    await deleteWith(inMemoryStores({ cast: racingCast, roles }))(request("12", "4"));

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

describe("delete cast member handler with props", () => {
  const basket = {
    id: 1,
    itemId: "pirate-sketch",
    name: "Bread basket",
    quantity: 1,
    roleIds: [9],
    carrierIds: [12],
  };
  const setUpWithBasket = () => {
    const props = inMemoryPropStore([{ productionId: "2027", props: [basket] }]);
    const roles = inMemoryRoleStore([
      { productionId: "2027", roles: [aRole(9, "pirate-sketch", [12, 1])] },
    ]);
    return { props, ...setUp(roles, props) };
  };

  it("takes them off every prop they carried", async () => {
    const { props, handler } = setUpWithBasket();

    expect((await handler(request("12", "4"))).statusCode).toBe(204);

    expect((await props.list("2027")).props[0]?.carrierIds).toEqual([]);
  });

  it("changes no props when the delete is refused", async () => {
    const { props, handler } = setUpWithBasket();

    expect((await handler(request("12", "3"))).statusCode).toBe(409);

    expect((await props.list("2027")).props[0]?.carrierIds).toEqual([12]);
  });
});

describe("delete cast member handler with mics", () => {
  // Made-up cast: member 12 is on Mic 3 in Space Sketch and Mic 5 in the Finale; member 1 is
  // on Mic 4 in the Finale.
  const setUpWithMics = () => {
    const micPlots = inMemoryMicPlotStore([
      {
        productionId: "2027",
        items: [
          { itemId: "space-sketch", mics: [{ channel: 3, castMemberId: 12 }] },
          {
            itemId: "finale",
            mics: [
              { channel: 4, castMemberId: 1 },
              { channel: 5, castMemberId: 12 },
            ],
          },
        ],
      },
    ]);
    const roles = inMemoryRoleStore([
      {
        productionId: "2027",
        roles: [aRole(8, "space-sketch", [12]), aRole(9, "finale", [12, 1])],
      },
    ]);
    const store = inMemoryCastStore([
      aCastList([aCastMember(1), aCastMember(12, { revision: 4 })]),
    ]);
    const handler = deleteWith(inMemoryStores({ cast: store, roles, micPlots }));
    return { micPlots, handler };
  };

  it("frees their channels in every item, leaving everyone else's", async () => {
    const { micPlots, handler } = setUpWithMics();

    expect((await handler(request("12", "4"))).statusCode).toBe(204);

    expect((await micPlots.list("2027")).items).toEqual([
      { itemId: "finale", mics: [{ channel: 4, castMemberId: 1 }] },
    ]);
  });

  it("changes no mics when the delete is refused", async () => {
    const { micPlots, handler } = setUpWithMics();

    expect((await handler(request("12", "3"))).statusCode).toBe(409);

    expect((await micPlots.list("2027")).items).toHaveLength(2);
  });
});

describe("delete cast member handler with costumes", () => {
  // Made-up cast: Jo Brown (12) is a Pirate (8) in Opening Number and a Sailor (9) in the
  // Finale, with Kim Lee (1) in both; Kim is Captain Hook (7) too.
  const roleList = [
    aRole(7, "opening-number", [1]),
    aRole(8, "opening-number", [12, 1]),
    aRole(9, "finale", [12, 1]),
  ];
  const kims = [aCostume("opening-number", 7, 1), aCostume("opening-number", 8, 1)];
  const kimAsSailor = aCostume("finale", 9, 1);
  const joAsPirate = aCostume("opening-number", 8, 12);
  const joAsSailor = aCostume("finale", 9, 12);
  function setUpWithCostumes() {
    const stores = inMemoryStores({
      cast: inMemoryCastStore([aCastList([aCastMember(1), aCastMember(12, { revision: 4 })])]),
      roles: inMemoryRoleStore([{ productionId: "2027", roles: roleList }]),
      costumes: inMemoryCostumeStore([
        { productionId: "2027", costumes: [...kims, joAsPirate, kimAsSailor, joAsSailor] },
      ]),
    });
    return { stores, handler: deleteWith(stores) };
  }

  it("deletes their costumes in every item, changing nothing else about those items", async () => {
    const { stores, handler } = setUpWithCostumes();

    expect((await handler(request("12", "4"))).statusCode).toBe(204);

    expect((await stores.costumes.list("2027")).costumes).toEqual([...kims, kimAsSailor]);
    expect((await stores.roles.list("2027")).roles.map((role) => role.castMemberIds)).toEqual([
      [1],
      [1],
      [1],
    ]);
  });

  it("keeps their costumes when the delete is refused", async () => {
    const { stores, handler } = setUpWithCostumes();

    expect((await handler(request("12", "3"))).statusCode).toBe(409);

    expect((await stores.costumes.list("2027")).costumes).toEqual([
      ...kims,
      joAsPirate,
      kimAsSailor,
      joAsSailor,
    ]);
  });
});
