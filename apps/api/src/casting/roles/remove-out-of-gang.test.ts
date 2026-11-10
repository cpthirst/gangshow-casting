import type { ItemGang, Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import { inMemoryMicPlotStore } from "#/production/mic-plot/mic-plot-store.ts";
import { inMemoryPropStore } from "#/production/props/prop-store.ts";
import { aCastList, aCastMember } from "#/show/cast/cast.fixture.ts";
import { inMemoryCastStore } from "#/show/cast/cast-store.ts";
import { anItem, aRunningOrder } from "#/show/running-order/running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { outOfGangRemoval } from "./remove-out-of-gang.ts";
import { inMemoryRoleStore } from "./role-store.ts";

// Made-up names only (CLAUDE.md safeguarding): Sam Sample is in Scouts, Alex Smith has no
// section and Poppy Example is in Beavers.
const SAM = 1;
const ALEX = 2;
const POPPY = 3;
const pirateSketch = anItem("Pirate Sketch").id;
const openingNumber = anItem("Opening Number").id;

const aRole = (id: number, itemId: string, castMemberIds: number[]): Role => ({
  id,
  itemId,
  name: `Role ${id}`,
  size: castMemberIds.length > 1 ? "ensemble" : "lead",
  castMemberIds,
  revision: 1,
});
const captain = aRole(1, pirateSketch, [SAM]);
const pirates = aRole(2, pirateSketch, [ALEX, POPPY]);
const opening = aRole(3, openingNumber, [SAM]);

/** Pirate Sketch now for the given gang, and Opening Number for the Senior gang by default.
 *  Changing the role numbered `failingRole`, if given, fails. */
function setUp(gang: ItemGang = "junior", failingRole?: number) {
  const order = aRunningOrder(7, { first: ["Opening Number", "Pirate Sketch"] });
  order.halves[0].items[1] = { ...anItem("Pirate Sketch"), gang };
  const roles = inMemoryRoleStore([{ productionId: "2027", roles: [captain, pirates, opening] }]);
  const props = inMemoryPropStore([
    {
      productionId: "2027",
      props: [
        {
          id: 1,
          itemId: pirateSketch,
          name: "Cutlass",
          quantity: 1,
          roleIds: [pirates.id],
          carrierIds: [ALEX],
        },
      ],
    },
  ]);
  const micPlots = inMemoryMicPlotStore([
    {
      productionId: "2027",
      items: [{ itemId: pirateSketch, mics: [{ channel: 4, castMemberId: SAM }] }],
    },
  ]);
  const removeOutOfGang = outOfGangRemoval({
    runningOrders: inMemoryRunningOrderStore([order]),
    cast: inMemoryCastStore([
      aCastList([
        aCastMember(SAM, { firstName: "Sam", lastName: "Sample", section: "scouts" }),
        aCastMember(ALEX, { firstName: "Alex", lastName: "Smith", section: null }),
        aCastMember(POPPY, { firstName: "Poppy", lastName: "Example", section: "beavers" }),
      ]),
    ]),
    roles: {
      ...roles,
      update: async (...args: Parameters<typeof roles.update>) => {
        if (args[1] === failingRole) throw new Error("table unavailable");
        return roles.update(...args);
      },
    },
    props,
    micPlots,
  });
  const castIn = async (role: Role) =>
    (await roles.list("2027")).roles.find(({ id }) => id === role.id)?.castMemberIds;
  return { removeOutOfGang, castIn, props, micPlots };
}

const inPirateSketch = (role: Role) => role.itemId === pirateSketch;

describe("removing who isn't in an item's gang", () => {
  it("takes out of the item's roles everyone not in its gang", async () => {
    const { removeOutOfGang, castIn } = setUp();

    await removeOutOfGang("2027", inPirateSketch);

    expect(await castIn(captain)).toEqual([]);
    expect(await castIn(pirates)).toEqual([POPPY]);
  });

  it("leaves the casting of the roles it isn't asked about", async () => {
    const { removeOutOfGang, castIn } = setUp();

    await removeOutOfGang("2027", (role) => role.itemId === openingNumber);

    expect(await castIn(captain)).toEqual([SAM]);
    expect(await castIn(opening)).toEqual([SAM]);
  });

  it("leaves everyone when they're all in the item's gang", async () => {
    const { removeOutOfGang, castIn } = setUp("both");

    await removeOutOfGang("2027", inPirateSketch);

    expect(await castIn(captain)).toEqual([SAM]);
    expect(await castIn(pirates)).toEqual([ALEX, POPPY]);
  });

  // The clean-up itself is tested with the stores (production-props FR28, production-mics FR9).
  it("takes props and mic channels off those it removes, as any casting change does", async () => {
    const { removeOutOfGang, props, micPlots } = setUp();

    await removeOutOfGang("2027", inPirateSketch);

    expect((await props.list("2027")).props[0]?.carrierIds).toEqual([]);
    expect((await micPlots.list("2027")).items).toEqual([]);
  });

  it("frees the mics of those it did remove when changing a later role fails", async () => {
    const { removeOutOfGang, castIn, micPlots } = setUp("junior", pirates.id);

    await expect(removeOutOfGang("2027", inPirateSketch)).rejects.toThrow();

    expect(await castIn(captain)).toEqual([]);
    expect((await micPlots.list("2027")).items).toEqual([]);
  });
});
