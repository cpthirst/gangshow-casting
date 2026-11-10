import { AddRoleRefusal, Role, type RoleList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { inMemoryMicPlotStore } from "#/production/mic-plot/mic-plot-store.ts";
import { inMemoryPropStore } from "#/production/props/prop-store.ts";
import { aCastList, aCastMember } from "#/show/cast/cast.fixture.ts";
import { inMemoryCastStore } from "#/show/cast/cast-store.ts";
import { aRunningOrder, itemId } from "#/show/running-order/running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
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
  return {
    roles,
    initial,
    handler: createUpdateRole(roles, inMemoryRunningOrderStore(), cast, noFollowers()),
  };
}

const noFollowers = () => ({ props: inMemoryPropStore(), micPlots: inMemoryMicPlotStore() });

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
    return {
      roles,
      handler: createUpdateRole(roles, inMemoryRunningOrderStore(), cast, noFollowers()),
    };
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
    return {
      props,
      handler: createUpdateRole(roles, inMemoryRunningOrderStore(), cast, {
        props,
        micPlots: inMemoryMicPlotStore(),
      }),
    };
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

describe("update role handler with mics", () => {
  // Made-up cast: Alex (12) is Alien 1 and in the Chorus in Space Sketch, on Mic 3 there and
  // in the Finale; Sam (13) is in the Chorus.
  const alien: Role = { ...role(9, "Alien 1"), itemId: "space-sketch", castMemberIds: [12] };
  const chorus: Role = {
    ...role(10, "Chorus"),
    itemId: "space-sketch",
    size: "ensemble",
    castMemberIds: [12, 13],
  };
  const finale: Role = { ...role(11, "Finale"), itemId: "finale", castMemberIds: [12] };
  const onMic3 = (itemId: string) => ({ itemId, mics: [{ channel: 3, castMemberId: 12 }] });
  function setUpSpaceSketch(roleList: Role[]) {
    const roles = inMemoryRoleStore([{ productionId: "2027", roles: roleList }]);
    const cast = inMemoryCastStore([aCastList([aCastMember(12), aCastMember(13)])]);
    const micPlots = inMemoryMicPlotStore([
      { productionId: "2027", items: [onMic3("space-sketch"), onMic3("finale")] },
    ]);
    return {
      micPlots,
      handler: createUpdateRole(roles, inMemoryRunningOrderStore(), cast, {
        props: inMemoryPropStore(),
        micPlots,
      }),
    };
  }
  const recast = (r: Role, castMemberIds: number[]) =>
    request(String(r.id), { name: r.name, size: r.size, castMemberIds, revision: r.revision });
  const micsIn = async (
    micPlots: ReturnType<typeof setUpSpaceSketch>["micPlots"],
    itemId: string,
  ) => (await micPlots.list("2027")).items.find((plot) => plot.itemId === itemId)?.mics ?? [];

  it("frees their channel in the item when they're taken out of it, keeping their others", async () => {
    const { micPlots, handler } = setUpSpaceSketch([alien, finale]);

    expect((await handler(recast(alien, []))).statusCode).toBe(200);

    expect(await micsIn(micPlots, "space-sketch")).toEqual([]);
    expect(await micsIn(micPlots, "finale")).toEqual([{ channel: 3, castMemberId: 12 }]);
  });

  it("leaves the mic with the old cast member when a role is recast and they stay in the item", async () => {
    const { micPlots, handler } = setUpSpaceSketch([alien, chorus, finale]);

    expect((await handler(recast(alien, [13]))).statusCode).toBe(200);

    expect(await micsIn(micPlots, "space-sketch")).toEqual([{ channel: 3, castMemberId: 12 }]);
  });

  it("changes no mics when the recast is refused", async () => {
    const { micPlots, handler } = setUpSpaceSketch([alien, finale]);

    expect((await handler(recast({ ...alien, revision: 5 }, []))).statusCode).toBe(409);

    expect(await micsIn(micPlots, "space-sketch")).toEqual([{ channel: 3, castMemberId: 12 }]);
  });
});

describe("update role handler in a gang's item", () => {
  // Made-up cast: Sam Example (12) is in Cubs, Sam Sample (13) in Scouts. Beaver Bop is for
  // the Junior gang; Sam Sample was in its Dam Builders before it was.
  const inBeaverBop = { itemId: itemId("Beaver Bop") };
  const initial: RoleList = {
    productionId: "2027",
    roles: [
      { ...role(8, "Chief Beaver"), ...inBeaverBop, size: "lead" },
      { ...role(9, "Dam Builders"), ...inBeaverBop, size: "ensemble", castMemberIds: [13] },
    ],
  };
  function setUpBeaverBop() {
    const roles = inMemoryRoleStore([initial]);
    const order = aRunningOrder(7, { first: ["Beaver Bop"] });
    for (const item of order.halves[0].items) item.gang = "junior";
    const cast = inMemoryCastStore([
      aCastList([
        aCastMember(12, { section: "cubs" }),
        aCastMember(13, { lastName: "Sample", section: "scouts" }),
      ]),
    ]);
    const runningOrders = inMemoryRunningOrderStore([order]);
    return { roles, handler: createUpdateRole(roles, runningOrders, cast, noFollowers()) };
  }

  it("refuses casting someone outside the item's gang, saying so and changing nothing", async () => {
    const { roles, handler } = setUpBeaverBop();
    const body = { name: "Chief Beaver", size: "lead", castMemberIds: [13], revision: 1 };

    const res = await handler(request("8", body));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body ?? "")).toEqual({ message: "Sam Sample isn't in the Junior gang" });
    expect(await roles.list("2027")).toEqual(initial);
  });

  it("keeps someone cast before the item was for their gang", async () => {
    const { handler } = setUpBeaverBop();
    const body = { name: "Dam Builders", size: "ensemble", castMemberIds: [13, 12], revision: 1 };

    expect((await handler(request("9", body))).statusCode).toBe(200);
  });
});
