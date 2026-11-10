import { CastMember } from "@app/shared";
import { describe, expect, it, vi } from "vitest";
import { outOfGangRemoval, type RemoveOutOfGang } from "#/casting/roles/remove-out-of-gang.ts";
import { inMemoryMicPlotStore } from "#/production/mic-plot/mic-plot-store.ts";
import {
  anItem,
  aRunningOrder,
  itemId,
  noGangRemoval,
} from "#/show/running-order/running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { inMemoryStores } from "#/storage/stores.fixture.ts";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { inMemoryCastStore } from "./cast-store.ts";
import { createUpdateCastMember } from "./update-cast-member.ts";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
const changes = {
  firstName: "Sam",
  lastName: "Example",
  section: "explorers",
  group: "Riverside ESU",
};

const request = (castId: string, body: unknown, productionId = "2027") => ({
  pathParameters: { productionId, castId },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

function setUp() {
  const store = inMemoryCastStore([aCastList([aCastMember(12, { revision: 4 })])]);
  return { store, handler: createUpdateCastMember(store, noGangRemoval) };
}

const member12 = async (store: ReturnType<typeof setUp>["store"]) =>
  (await store.list("2027"))?.members.find((m) => m.id === 12);

describe("update cast member handler", () => {
  it("returns 200 with the updated member at the next revision", async () => {
    const { store, handler } = setUp();

    const res = await handler(request("12", { ...changes, revision: 4 }));

    expect(res.statusCode).toBe(200);
    expect(CastMember.parse(JSON.parse(res.body ?? ""))).toEqual({
      ...changes,
      id: 12,
      revision: 5,
    });
    expect((await member12(store))?.section).toBe("explorers");
  });

  it("saves edited Singing and Acting notes", async () => {
    const { store, handler } = setUp();
    const notes = { singing: "Alto, harmonies", acting: "Comic timing" };

    expect((await handler(request("12", { ...changes, ...notes, revision: 4 }))).statusCode).toBe(
      200,
    );

    expect(await member12(store)).toMatchObject(notes);
  });

  it("returns 409 for a stale revision, saving nothing", async () => {
    const { store, handler } = setUp();

    expect((await handler(request("12", { ...changes, revision: 3 }))).statusCode).toBe(409);
    expect((await member12(store))?.revision).toBe(4);
  });

  it.each([
    ["an unknown member", request("99", { ...changes, revision: 1 })],
    ["a production with no cast list", request("12", { ...changes, revision: 4 }, "1999")],
  ])("returns 404 for %s, saving nothing", async (_case, event) => {
    const { store, handler } = setUp();

    expect((await handler(event)).statusCode).toBe(404);
    expect(await member12(store)).toEqual(aCastMember(12, { revision: 4 }));
  });

  it.each([
    ["an empty last name", request("12", { ...changes, lastName: "", revision: 4 })],
    ["a changed id", request("12", { ...changes, id: 99, revision: 4 })],
    ["no revision", request("12", changes)],
    ["a non-numeric cast id", request("twelve", { ...changes, revision: 4 })],
    ["malformed JSON", request("12", "{not json")],
  ])("returns 400 for %s, saving nothing", async (_case, event) => {
    const { store, handler } = setUp();

    expect((await handler(event)).statusCode).toBe(400);
    expect((await member12(store))?.revision).toBe(4);
  });
});

describe("update cast member handler, with a section change", () => {
  // Member 12, in Cubs, is cast in Beaver Bop (Junior) and Grand Finale (Both), and has
  // channel 2 in Beaver Bop.
  async function setUpCasting(removal?: RemoveOutOfGang) {
    const order = aRunningOrder(1, { first: ["Beaver Bop", "Grand Finale"] });
    order.halves[0].items = [
      { ...anItem("Beaver Bop"), gang: "junior" },
      { ...anItem("Grand Finale"), gang: "both" },
    ];
    const stores = inMemoryStores({
      runningOrders: inMemoryRunningOrderStore([order]),
      cast: inMemoryCastStore([aCastList([aCastMember(12, { section: "cubs", revision: 4 })])]),
      micPlots: inMemoryMicPlotStore([
        {
          productionId: "2027",
          items: [{ itemId: itemId("Beaver Bop"), mics: [{ channel: 2, castMemberId: 12 }] }],
        },
      ]),
    });
    const cast = async (title: string, name: string) =>
      stores.roles.add("2027", itemId(title), { name, size: "ensemble", castMemberIds: [12] });
    await cast("Beaver Bop", "Chief Beaver");
    await cast("Beaver Bop", "Dam Builders");
    await cast("Grand Finale", "Chorus");
    const handler = createUpdateCastMember(stores.cast, removal ?? outOfGangRemoval(stores));
    const castIn = async () =>
      Object.fromEntries(
        (await stores.roles.list("2027")).roles.map((role) => [role.name, role.castMemberIds]),
      );
    return { handler, castIn, stores };
  }
  // The client sends member 12 in Scouts, asking nobody.
  const toScouts = request("12", { ...changes, section: "scouts", revision: 4 });

  it("takes them out of the roles of items not for their new gang", async () => {
    const { handler, castIn, stores } = await setUpCasting();

    expect((await handler(toScouts)).statusCode).toBe(200);

    expect(await castIn()).toEqual({ "Chief Beaver": [], "Dam Builders": [], Chorus: [12] });
    expect((await stores.micPlots.list("2027")).items).toEqual([]);
  });

  it("still answers 200 when the removal fails, logging no names", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handler } = await setUpCasting(async () => {
      throw new Error("Sam Example is in role 1");
    });

    expect((await handler(toScouts)).statusCode).toBe(200);

    expect(log).toHaveBeenCalledWith(expect.stringContaining("production 2027"));
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining("Sam"));
    log.mockRestore();
  });
});
