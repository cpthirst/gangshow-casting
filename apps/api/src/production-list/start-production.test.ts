import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProductionList } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Handler } from "#/http/handler.ts";
import { createRoutes } from "#/routes.ts";
import { jo } from "#/show/cast/cast.fixture.ts";
import { inMemoryCastStore } from "#/show/cast/cast-store.ts";
import { aRunningOrder } from "#/show/running-order/running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { fileStores, itemFileStores } from "#/storage/data-stores.ts";
import { inMemoryUsageStore } from "#/usage/usage-store.ts";
import { inMemoryProductionListStore, type ProductionListStore } from "./production-list-store.ts";
import { createStartProduction } from "./start-production.ts";

const asking = (year: unknown) => ({ body: JSON.stringify({ year }) });

type Stores = Parameters<typeof createStartProduction>[0];
const starting = (productions: ProductionListStore, others: Partial<Stores> = {}) =>
  createStartProduction({
    productions,
    cast: inMemoryCastStore(),
    runningOrders: inMemoryRunningOrderStore(),
    ...others,
  });
const down = async () => {
  throw new Error("The store is down");
};
const REFUSAL_AFTER_2028 = { message: "The year must be a four-digit year later than 2028." };

describe("POST /api/productions", () => {
  it("adds the production and answers with the list holding it", async () => {
    const productions = inMemoryProductionListStore(["2027"]);

    const res = await starting(productions)(asking("2028"));

    expect(res.statusCode).toBe(201);
    const answered = ProductionList.parse(JSON.parse(res.body ?? ""));
    expect(answered.productions.toSorted()).toEqual(["2027", "2028"]);
    expect((await productions.list()).productions.toSorted()).toEqual(["2027", "2028"]);
  });

  it("writes the new production's empty cast list, so members can be added to it", async () => {
    const cast = inMemoryCastStore();

    await starting(inMemoryProductionListStore(["2027"]), { cast })(asking("2028"));

    expect(await cast.list("2028")).toEqual({ productionId: "2028", members: [] });
  });

  it.each(["2028", "2026", "next year"])(
    "refuses %j when 2028 is the newest, saying what would do, and starts nothing",
    async (year) => {
      const productions = inMemoryProductionListStore(["2027", "2028"]);
      const cast = inMemoryCastStore();

      const res = await starting(productions, { cast })(asking(year));

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body ?? "")).toEqual(REFUSAL_AFTER_2028);
      expect((await productions.list()).productions.toSorted()).toEqual(["2027", "2028"]);
      expect(await cast.list(year.replace(" ", "-"))).toBeUndefined();
    },
  );

  it("saves the new production's first running order, with no items", async () => {
    const runningOrders = inMemoryRunningOrderStore();

    await starting(inMemoryProductionListStore(["2027"]), { runningOrders })(asking("2028"));

    const order = await runningOrders.latest("2028");
    expect(order).toMatchObject({ productionId: "2028", title: "Gang Show 2028", version: 1 });
    expect(order?.halves.map(({ items }) => items)).toEqual([[], []]);
  });

  it.each([
    ["cast list", { cast: { start: down } }],
    ["first running order", { runningOrders: { save: down } }],
  ])("doesn't list a production whose %s couldn't be written", async (_what, broken) => {
    const productions = inMemoryProductionListStore(["2027"]);

    await expect(starting(productions, broken)(asking("2028"))).rejects.toThrow();

    expect((await productions.list()).productions).toEqual(["2027"]);
  });

  it("finishes a start that failed part way when it's tried again", async () => {
    const held = inMemoryProductionListStore(["2027"]);
    const cast = inMemoryCastStore();
    const runningOrders = inMemoryRunningOrderStore();
    const stores = { cast, runningOrders };
    const failing: ProductionListStore = { ...held, start: down };
    await expect(starting(failing, stores)(asking("2028"))).rejects.toThrow();

    const res = await starting(held, stores)(asking("2028"));

    expect(res.statusCode).toBe(201);
    expect((await held.list()).productions.toSorted()).toEqual(["2027", "2028"]);
    expect((await cast.list("2028"))?.members).toEqual([]);
    expect((await runningOrders.latest("2028"))?.version).toBe(1);
  });

  it("refuses in the same words an admin who loses a race to start the same year", async () => {
    // Someone else's start lands between this request's check and its write.
    let read = 0;
    const racing: ProductionListStore = {
      ...inMemoryProductionListStore(),
      list: async () =>
        read++ === 0 ? { productions: ["2027"] } : { productions: ["2027", "2028"] },
      start: async () => "exists",
    };

    const res = await starting(racing)(asking("2028"));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body ?? "")).toEqual(REFUSAL_AFTER_2028);
  });

  it("refuses a request that doesn't ask for a year as text", async () => {
    const res = await starting(inMemoryProductionListStore(["2027"]))(asking(2028));

    expect(res.statusCode).toBe(400);
  });
});

describe("a production just started, on the real stores", () => {
  let dataDir: string;
  let routes: ReturnType<typeof createRoutes>;
  let stores: ReturnType<typeof fileStores>;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "start-production-"));
    stores = fileStores(dataDir);
    routes = createRoutes(
      stores,
      inMemoryUsageStore(),
      itemFileStores({ DATA_DIR: dataDir }).stores,
    );
  });
  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  const start = (year: string) => routes["POST /api/productions"](asking(year));
  const read = async (handler: Handler, productionId = "2028") => {
    const res = await handler({ pathParameters: { productionId } });
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
  };

  it("has no cast, casting, props, mics or notes, and an empty running order", async () => {
    await start("2028");

    const empty = (rest: object) => ({ status: 200, body: { productionId: "2028", ...rest } });
    expect(await read(routes["GET /api/productions/{productionId}/cast"])).toEqual(
      empty({ members: [] }),
    );
    expect(await read(routes["GET /api/productions/{productionId}/roles"])).toEqual(
      empty({ roles: [] }),
    );
    expect(await read(routes["GET /api/productions/{productionId}/props"])).toEqual(
      empty({ props: [] }),
    );
    expect(await read(routes["GET /api/productions/{productionId}/mic-plot"])).toEqual(
      empty({ items: [] }),
    );
    for (const notes of [
      routes["GET /api/productions/{productionId}/item-notes"],
      routes["GET /api/productions/{productionId}/props-notes"],
      routes["GET /api/productions/{productionId}/scenery-notes"],
      routes["GET /api/productions/{productionId}/sfx-notes"],
      routes["GET /api/productions/{productionId}/wardrobe-notes"],
      routes["GET /api/productions/{productionId}/mic-plot-notes"],
    ]) {
      expect(await read(notes)).toEqual(empty({ notes: [] }));
    }
    for (const files of [
      routes["GET /api/productions/{productionId}/scenery-file-counts"],
      routes["GET /api/productions/{productionId}/sfx-file-counts"],
      routes["GET /api/productions/{productionId}/wardrobe-file-counts"],
    ]) {
      expect(await read(files)).toEqual({ status: 200, body: { counts: {} } });
    }
    const order = await read(routes["GET /api/productions/{productionId}/running-order"]);
    expect(order.status).toBe(200);
    expect(order.body.halves.map((half: { items: unknown[] }) => half.items)).toEqual([[], []]);
  });

  it("lets items be added and saved in its running order, as the page does", async () => {
    await start("2028");
    const pathParameters = { productionId: "2028" };
    const newItem = {
      title: "Curtain Up",
      cast: "Everyone",
      stage: ["full"],
      leads: "",
      comments: "",
      minutes: 5,
      printed: true,
    };

    const saved = await routes["POST /api/productions/{productionId}/running-order/versions"]({
      pathParameters,
      body: JSON.stringify({
        baseVersion: 1,
        change: {
          type: "update",
          halves: [
            { id: "first-half", items: [newItem] },
            { id: "second-half", items: [] },
          ],
        },
      }),
    });

    expect(saved.statusCode).toBe(201);
    const order = await read(routes["GET /api/productions/{productionId}/running-order"]);
    expect(order.body.version).toBe(2);
    expect(order.body.halves[0].items.map((item: { title: string }) => item.title)).toEqual([
      "Curtain Up",
    ]);
  });

  it("gives a cast member added to it the first id", async () => {
    await start("2028");

    const added = await routes["POST /api/productions/{productionId}/cast"]({
      pathParameters: { productionId: "2028" },
      body: JSON.stringify(jo),
    });

    expect(added.statusCode).toBe(201);
    expect(JSON.parse(added.body ?? "")).toMatchObject({ id: 1 });
  });

  it("leaves last year's data as it was, and none of it appears in the new one", async () => {
    await stores.runningOrders.save(aRunningOrder(1, { first: ["Pirate Sketch"] }));
    await stores.cast.start("2027");
    await stores.cast.add("2027", jo);
    await stores.itemNotes.save("2027", "pirate-sketch", 0, "Bring a parrot");
    const role = await stores.roles.add("2027", "pirate-sketch", {
      name: "Captain",
      size: "lead",
      castMemberIds: [1],
    });
    if (role === "name-taken") throw new Error("The role wasn't added");
    await stores.props.add("2027", "pirate-sketch", {
      name: "Treasure chest",
      quantity: 1,
      roleIds: [role.id],
      carrierIds: [],
    });
    await stores.micPlots.allocate("2027", "pirate-sketch", 1, 1);
    const before = {
      cast: await stores.cast.list("2027"),
      order: await stores.runningOrders.latest("2027"),
      notes: await stores.itemNotes.list("2027"),
      roles: await stores.roles.list("2027"),
      props: await stores.props.list("2027"),
      mics: await stores.micPlots.list("2027"),
    };
    expect(
      [before.roles.roles, before.props.props, before.mics.items].map((l) => l.length),
    ).toEqual([1, 1, 1]);

    await start("2028");

    expect(await stores.cast.list("2027")).toEqual(before.cast);
    expect(await stores.runningOrders.latest("2027")).toEqual(before.order);
    expect(await stores.itemNotes.list("2027")).toEqual(before.notes);
    expect(await stores.roles.list("2027")).toEqual(before.roles);
    expect(await stores.props.list("2027")).toEqual(before.props);
    expect(await stores.micPlots.list("2027")).toEqual(before.mics);
    expect((await stores.roles.list("2028")).roles).toEqual([]);
    expect((await stores.props.list("2028")).props).toEqual([]);
    expect((await stores.micPlots.list("2028")).items).toEqual([]);
    expect((await stores.cast.list("2028"))?.members).toEqual([]);
    expect((await stores.runningOrders.latest("2028"))?.halves.flatMap((h) => h.items)).toEqual([]);
    expect((await stores.itemNotes.list("2028")).notes).toEqual([]);
  });
});
