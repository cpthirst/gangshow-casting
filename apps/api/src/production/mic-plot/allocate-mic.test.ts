import { ItemMicPlot, type Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import { inMemoryRoleStore } from "#/casting/roles/role-store.ts";
import { aRunningOrder, itemId } from "#/show/running-order/running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { createAllocateMic } from "./allocate-mic.ts";
import { inMemoryMicPlotStore } from "./mic-plot-store.ts";

const opening = itemId("Opening Number");
const finale = itemId("Finale");
// Made-up cast member ids: Alex and Sam are cast in Opening Number; Jo only in the Finale.
const [alex, sam, jo] = [1, 2, 3];

const aRole = (id: number, item: string, castMemberIds: number[]): Role => ({
  id,
  itemId: item,
  name: `Role ${id}`,
  size: "ensemble",
  castMemberIds,
  revision: 1,
});

const request = (body: unknown, item = opening, productionId = "2027") => ({
  pathParameters: { productionId, itemId: item },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

function setUp() {
  const micPlots = inMemoryMicPlotStore();
  const runningOrders = inMemoryRunningOrderStore([
    aRunningOrder(3, { first: ["Opening Number"], second: ["Finale"] }),
  ]);
  const roles = inMemoryRoleStore([
    {
      productionId: "2027",
      roles: [aRole(1, opening, [alex]), aRole(2, opening, [sam]), aRole(3, finale, [jo])],
    },
  ]);
  return { micPlots, handler: createAllocateMic(micPlots, runningOrders, roles) };
}

const micsIn = async (micPlots: ReturnType<typeof setUp>["micPlots"]) =>
  (await micPlots.list("2027")).items;

describe("allocate mic handler", () => {
  it("gives a channel to a cast member cast in the item, answering with its mic plot", async () => {
    const { micPlots, handler } = setUp();

    const res = await handler(request({ channel: 3, castMemberId: alex }));

    expect(res.statusCode).toBe(200);
    const plot = { itemId: opening, mics: [{ channel: 3, castMemberId: alex }] };
    expect(ItemMicPlot.parse(JSON.parse(res.body ?? ""))).toEqual(plot);
    expect(await micsIn(micPlots)).toEqual([plot]);
  });

  it("clears a channel", async () => {
    const { micPlots, handler } = setUp();
    await handler(request({ channel: 3, castMemberId: alex }));

    const res = await handler(request({ channel: 3, castMemberId: null }));

    expect(res.statusCode).toBe(200);
    expect(ItemMicPlot.parse(JSON.parse(res.body ?? ""))).toEqual({ itemId: opening, mics: [] });
    expect(await micsIn(micPlots)).toEqual([]);
  });

  it("refuses a cast member not cast in the item, changing nothing", async () => {
    const { micPlots, handler } = setUp();

    const res = await handler(request({ channel: 3, castMemberId: jo }));

    expect(res.statusCode).toBe(400);
    expect(await micsIn(micPlots)).toEqual([]);
  });

  it("refuses a second channel for someone already on one in the item, with its plot as it is", async () => {
    const { micPlots, handler } = setUp();
    await handler(request({ channel: 3, castMemberId: alex }));
    const before = await micsIn(micPlots);

    const res = await handler(request({ channel: 4, castMemberId: alex }));

    expect(res.statusCode).toBe(409);
    expect(ItemMicPlot.parse(JSON.parse(res.body ?? ""))).toEqual(before[0]);
    expect(await micsIn(micPlots)).toEqual(before);
  });

  it.each([
    ["Mic 0", { channel: 0, castMemberId: alex }],
    ["Mic 25", { channel: 25, castMemberId: alex }],
    ["no channel", { castMemberId: alex }],
    ["no cast member", { channel: 3 }],
    ["a body that isn't JSON", "{"],
  ])("refuses %s with 400, changing nothing", async (_what, body) => {
    const { micPlots, handler } = setUp();

    expect((await handler(request(body))).statusCode).toBe(400);
    expect(await micsIn(micPlots)).toEqual([]);
  });

  it("answers 404 for an item that isn't in the latest saved running order", async () => {
    const { micPlots, handler } = setUp();

    const res = await handler(request({ channel: 3, castMemberId: alex }, "itm_old-sketch"));

    expect(res.statusCode).toBe(404);
    expect(await micsIn(micPlots)).toEqual([]);
  });

  it("answers 404 for a production id that isn't valid", async () => {
    const { handler } = setUp();

    expect(
      (await handler(request({ channel: 3, castMemberId: alex }, opening, "../x"))).statusCode,
    ).toBe(404);
  });
});
