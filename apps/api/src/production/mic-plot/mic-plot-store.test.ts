import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { behavesAsAMicPlotStore } from "./mic-plot-store.contract.ts";
import { fileMicPlotStore, inMemoryMicPlotStore } from "./mic-plot-store.ts";

describe("in-memory mic plot store", () => {
  behavesAsAMicPlotStore(async (saved) => inMemoryMicPlotStore(saved));
});

describe("file mic plot store", () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "mic-plot-"));
  });
  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  const writeMicPlotFile = async (productionId: string, content: unknown) => {
    await mkdir(join(dataDir, productionId), { recursive: true });
    await writeFile(join(dataDir, productionId, "mic-plot.json"), JSON.stringify(content));
  };

  behavesAsAMicPlotStore(async (saved) => {
    for (const list of saved) await writeMicPlotFile(list.productionId, list);
    return fileMicPlotStore(dataDir);
  });

  it("refuses a mic plot file that isn't valid", async () => {
    await writeMicPlotFile("2027", {
      productionId: "2027",
      items: [{ itemId: "finale", mics: [{ channel: 25, castMemberId: 1 }] }],
    });

    await expect(fileMicPlotStore(dataDir).list("2027")).rejects.toThrow("invalid");
  });

  it("refuses a mic plot file for another production", async () => {
    await writeMicPlotFile("2027", { productionId: "2028", items: [] });

    await expect(fileMicPlotStore(dataDir).list("2027")).rejects.toThrow("invalid");
  });

  it("refuses a production id that isn't a safe folder name", async () => {
    await expect(fileMicPlotStore(dataDir).list("../etc")).rejects.toThrow();
  });
});
