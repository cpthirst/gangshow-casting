import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { behavesAsACostumeStore } from "./costume-store.contract.ts";
import { fileCostumeStore, inMemoryCostumeStore } from "./costume-store.ts";

describe("in-memory costume store", () => {
  behavesAsACostumeStore(async (saved) => inMemoryCostumeStore(saved));
});

describe("file costume store", () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "costumes-"));
  });
  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  const writeCostumesFile = async (productionId: string, content: unknown) => {
    await mkdir(join(dataDir, productionId), { recursive: true });
    await writeFile(join(dataDir, productionId, "costumes.json"), JSON.stringify(content));
  };

  behavesAsACostumeStore(async (saved) => {
    for (const list of saved) await writeCostumesFile(list.productionId, list);
    return fileCostumeStore(dataDir);
  });

  it("refuses a costumes file for another production", async () => {
    await writeCostumesFile("2027", { productionId: "2028", costumes: [] });

    await expect(fileCostumeStore(dataDir).list("2027")).rejects.toThrow("invalid");
  });

  it("refuses a production id that isn't a safe folder name", async () => {
    await expect(fileCostumeStore(dataDir).list("../etc")).rejects.toThrow();
  });
});
