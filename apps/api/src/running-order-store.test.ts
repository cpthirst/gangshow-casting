import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunningOrder } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { behavesAsARunningOrderStore } from "./running-order-store.contract.ts";
import { fileRunningOrderStore, inMemoryRunningOrderStore } from "./running-order-store.ts";

describe("in-memory running order store", () => {
  behavesAsARunningOrderStore(async (initial) => inMemoryRunningOrderStore(initial));
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

  behavesAsARunningOrderStore(async (initial = []) => {
    for (const order of initial) await writeVersion(order);
    return fileRunningOrderStore(dataDir);
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
