import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { behavesAsAPropStore } from "./prop-store.contract.ts";
import { filePropStore, inMemoryPropStore } from "./prop-store.ts";

describe("in-memory prop store", () => {
  behavesAsAPropStore(async (saved) => inMemoryPropStore(saved));
});

describe("file prop store", () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "props-"));
  });
  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  const writePropsFile = async (productionId: string, content: unknown) => {
    await mkdir(join(dataDir, productionId), { recursive: true });
    await writeFile(join(dataDir, productionId, "props.json"), JSON.stringify(content));
  };

  behavesAsAPropStore(async (saved) => {
    for (const list of saved) await writePropsFile(list.productionId, list);
    return filePropStore(dataDir);
  });

  it("gives a prop saved before props had quantities a quantity of 1", async () => {
    const chest = { id: 1, itemId: "pirate-sketch", name: "Treasure chest", roleIds: [] };
    await writePropsFile("2027", { productionId: "2027", props: [chest] });

    expect((await filePropStore(dataDir).list("2027")).props).toEqual([{ ...chest, quantity: 1 }]);
  });

  it("refuses a props file that isn't valid", async () => {
    await writePropsFile("2027", { productionId: "2027", props: [{ id: 1 }] });

    await expect(filePropStore(dataDir).list("2027")).rejects.toThrow("invalid");
  });

  it("refuses a props file for another production", async () => {
    await writePropsFile("2027", { productionId: "2028", props: [] });

    await expect(filePropStore(dataDir).list("2027")).rejects.toThrow("invalid");
  });

  it("refuses a production id that isn't a safe folder name", async () => {
    await expect(filePropStore(dataDir).list("../etc")).rejects.toThrow();
  });
});
