import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileDepartments, ProductionList } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ItemFileStores } from "#/production/item-files/item-file-store.ts";
import { createRoutes } from "#/routes.ts";
import { jo } from "#/show/cast/cast.fixture.ts";
import { aRunningOrder, itemId } from "#/show/running-order/running-order.fixture.ts";
import { fileStores, itemCleanupOf, itemFileStores } from "#/storage/data-stores.ts";
import { eachKindOf, keptFor, seedEveryKind } from "#/storage/item-data.fixture.ts";
import { inMemoryUsageStore } from "#/usage/usage-store.ts";
import { createDeleteProduction } from "./delete-production.ts";
import type { ProductionListStore } from "./production-list-store.ts";
import { PRODUCTIONS_FILE } from "./production-list-store.ts";

const pirate = itemId("Pirate Sketch");
const down = async () => {
  throw new Error("The store is down");
};

describe("DELETE /api/productions/{productionId}, on the local stores", () => {
  let dataDir: string;
  let stores: ReturnType<typeof fileStores>;
  let usage: ReturnType<typeof inMemoryUsageStore>;
  let files: ReturnType<typeof itemFileStores>;
  let folder: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "delete-production-"));
    stores = fileStores(dataDir);
    usage = inMemoryUsageStore();
    files = itemFileStores({ DATA_DIR: dataDir });
    if (files.folder === undefined) throw new Error("expected local files");
    folder = files.folder;
  });
  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  const holding = async (...years: string[]) => {
    for (const year of years) await stores.productions.start(year);
  };
  const seedShow = async (year: string) => {
    await stores.cast.start(year);
    await stores.cast.add(year, jo);
    await stores.runningOrders.save({
      ...aRunningOrder(1, { first: ["Pirate Sketch"] }),
      productionId: year,
    });
    await seedEveryKind(stores, folder, year, pirate);
  };
  const stuck = (held: ItemFileStores): ItemFileStores => ({
    ...held,
    sfx: { ...held.sfx, keepOnlyItems: down },
  });
  const deleting = (
    year: string,
    productions: ProductionListStore = stores.productions,
    fileStoresUsed: ItemFileStores = files.stores,
  ) =>
    createDeleteProduction(
      { productions },
      fileStoresUsed,
    )({ pathParameters: { productionId: year } });
  const remaining = async (year: string) => ({
    cast: await stores.cast.list(year),
    order: await stores.runningOrders.latest(year),
    kept: await keptFor(stores, files.stores, year, pirate),
  });

  it("leaves nothing stored for the production, and no longer lists it", async () => {
    await holding("2027", "2028");
    await seedShow("2027");

    const res = await deleting("2027");

    expect(res.statusCode).toBe(200);
    expect(ProductionList.parse(JSON.parse(res.body ?? ""))).toEqual({
      productions: ["2028"],
    });
    expect(await stores.cast.list("2027")).toBeUndefined();
    expect(await stores.runningOrders.latest("2027")).toBeUndefined();
    // A kind of per-item data the cut's clean-up covers, but the delete doesn't, shows by name.
    expect(await keptFor(stores, files.stores, "2027", pirate)).toEqual(
      eachKindOf(itemCleanupOf(stores, files.stores), 0),
    );
    // Whatever a new store writes under the production's folder goes too.
    expect(await readdir(dataDir)).not.toContain("2027");
    expect(await readdir(folder)).not.toContain("2027");
  });

  it("deletes every department's files itself, whatever else then fails", async () => {
    await holding("2027", "2028");
    await seedShow("2027");
    const failingLater = { ...stores.productions, eraseData: down };

    await expect(deleting("2027", failingLater)).rejects.toThrow();

    for (const department of fileDepartments) {
      expect(await files.stores[department].list("2027", pirate)).toEqual([]);
    }
  });

  it.each([
    ["the files", () => deleting("2027", stores.productions, stuck(files.stores))],
    ["the partition", () => deleting("2027", { ...stores.productions, eraseData: down })],
    ["the row", () => deleting("2027", { ...stores.productions, remove: down })],
  ])("stays marked, and finishes when repeated, if %s can't be deleted", async (_what, failing) => {
    await holding("2027", "2028");
    await seedShow("2027");
    await expect(failing()).rejects.toThrow();

    expect(await stores.productions.list()).toEqual({ productions: ["2028"], deleting: ["2027"] });

    const res = await deleting("2027");

    expect(res.statusCode).toBe(200);
    expect(await stores.productions.list()).toEqual({ productions: ["2028"] });
    expect(await readdir(dataDir)).not.toContain("2027");
  });

  it("keeps the row until everything else has gone", async () => {
    await holding("2027", "2028");
    await seedShow("2027");
    const order: string[] = [];
    const watching: ProductionListStore = {
      ...stores.productions,
      markDeleting: (year) => {
        order.push("mark");
        return stores.productions.markDeleting(year);
      },
      eraseData: (year) => {
        order.push("partition");
        return stores.productions.eraseData(year);
      },
      remove: (year) => {
        order.push("row");
        return stores.productions.remove(year);
      },
    };

    await deleting("2027", watching);

    expect(order).toEqual(["mark", "partition", "row"]);
  });

  it("refuses the newest production, saying so and changing nothing", async () => {
    await holding("2027", "2028");
    await seedShow("2028");
    const before = await remaining("2028");

    const res = await deleting("2028");

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body ?? "")).toEqual({
      message: "The newest production can't be deleted.",
    });
    expect((await stores.productions.list()).productions.toSorted()).toEqual(["2027", "2028"]);
    expect(await remaining("2028")).toEqual(before);
  });

  it("refuses the only production, as it's the newest", async () => {
    await holding("2027");

    expect((await deleting("2027")).statusCode).toBe(400);
    expect(await stores.productions.list()).toEqual({ productions: ["2027"] });
  });

  it.each(["1999", "../2027"])("answers 404 for %j, which the list doesn't hold", async (year) => {
    await holding("2027", "2028");

    expect((await deleting(year)).statusCode).toBe(404);
    expect((await stores.productions.list()).deleting).toBeUndefined();
  });

  it("leaves usage records to their own expiry", async () => {
    await holding("2027", "2028");
    await seedShow("2027");
    const at = "2026-11-02T09:00:00.000Z";
    await usage.record({ username: "jo", event: "page", page: "cast", at });
    const routes = createRoutes(stores, usage, files.stores);

    await routes["DELETE /api/productions/{productionId}"]({
      pathParameters: { productionId: "2027" },
    });

    expect((await usage.since("2026-11-01T00:00:00.000Z")).map((r) => r.username)).toEqual(["jo"]);
  });

  it("leaves the other productions as they were", async () => {
    await holding("2026", "2027", "2028");
    for (const year of ["2026", "2027", "2028"]) await seedShow(year);
    const before = [await remaining("2027"), await remaining("2028")];

    await deleting("2026");

    expect((await stores.productions.list()).productions.toSorted()).toEqual(["2027", "2028"]);
    expect([await remaining("2027"), await remaining("2028")]).toEqual(before);
    expect(await readdir(folder)).toEqual(expect.arrayContaining(["2027", "2028"]));
    expect(await readdir(dataDir)).toContain(PRODUCTIONS_FILE);
  });
});
