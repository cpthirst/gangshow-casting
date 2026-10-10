import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunningOrder } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aRunningOrder } from "./running-order.fixture.ts";
import { fileRunningOrderStore, inMemoryRunningOrderStore } from "./running-order-store.ts";

describe("in-memory running order store", () => {
  it("returns the highest stored version", async () => {
    const store = inMemoryRunningOrderStore([aRunningOrder(6), aRunningOrder(5)]);

    expect((await store.latest("2027"))?.version).toBe(6);
  });

  it("returns nothing for a production with no versions", async () => {
    expect(await inMemoryRunningOrderStore().latest("2027")).toBeUndefined();
  });
});

describe("file running order store", () => {
  let dataDir: string;
  const writeVersion = async (order: RunningOrder) => {
    const dir = join(dataDir, order.productionId, "running-order");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `v${order.version}.json`), JSON.stringify(order));
  };

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "running-order-"));
  });
  afterEach(() => rm(dataDir, { recursive: true, force: true }));

  it("returns the highest version by number, not by file name order", async () => {
    await writeVersion(aRunningOrder(9));
    await writeVersion(aRunningOrder(10));

    expect((await fileRunningOrderStore(dataDir).latest("2027"))?.version).toBe(10);
  });

  it("returns nothing for a production with no versions", async () => {
    expect(await fileRunningOrderStore(dataDir).latest("1999")).toBeUndefined();
  });

  it("refuses production ids that could reach outside the data folder", async () => {
    await expect(fileRunningOrderStore(dataDir).latest("../etc")).rejects.toThrow(
      /invalid production id/i,
    );
  });

  it("rejects a stored file that doesn't match the running order schema", async () => {
    const dir = join(dataDir, "2027", "running-order");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "v1.json"), JSON.stringify({ version: 1 }));

    await expect(fileRunningOrderStore(dataDir).latest("2027")).rejects.toThrow();
  });
});
