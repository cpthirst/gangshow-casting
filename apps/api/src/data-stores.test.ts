import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dataStores } from "./data-stores.ts";

describe("data stores", () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "data-stores-"));
  });
  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it("keeps item notes in the local files when no remote table is configured", async () => {
    const stores = dataStores({ DATA_DIR: dataDir });

    await stores.itemNotes.save("2027", "finale", 0, "Bows");

    const file = JSON.parse(await readFile(join(dataDir, "2027", "item-notes.json"), "utf8"));
    expect(file.notes).toEqual([{ itemId: "finale", text: "Bows", revision: 1 }]);
    expect(stores.where).toBe(`everything in files at ${dataDir}`);
  });

  it("says where item notes are kept when a remote table is configured", () => {
    const stores = dataStores({
      DATA_DIR: dataDir,
      DATA_TABLE: "GangshowData",
      AWS_REGION: "eu-west-2",
    });

    expect(stores.where).toBe(
      `item notes in table GangshowData (eu-west-2); everything else in files at ${dataDir}`,
    );
  });

  it("uses London when no region is given", () => {
    expect(dataStores({ DATA_DIR: dataDir, DATA_TABLE: "GangshowData" }).where).toContain(
      "(eu-west-2)",
    );
  });
});
