import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dataStores, sceneryFileStore, usageStore } from "./data-stores.ts";

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

  it("reads props from the local files when no remote table is configured", async () => {
    const props = [
      { id: 1, itemId: "finale", name: "Confetti", quantity: 1, roleIds: [], carrierIds: [] },
    ];
    await mkdir(join(dataDir, "2027"));
    await writeFile(
      join(dataDir, "2027", "props.json"),
      JSON.stringify({ productionId: "2027", props }),
    );

    expect((await dataStores({ DATA_DIR: dataDir }).props.list("2027")).props).toEqual(props);
  });

  it("keeps usage only in memory, never in the local files, when no remote table is configured", async () => {
    const usage = usageStore({ DATA_DIR: dataDir });

    await usage.record({ username: "robin", event: "session", at: "2026-10-24T09:00:00.000Z" });

    expect(await usage.recordedSince()).toBe("2026-10-24T09:00:00.000Z");
    expect(await readdir(dataDir)).toEqual([]);
  });

  it("keeps scenery files in the local files' own folder when no bucket is configured, even with a remote table", async () => {
    const place = join(dataDir, "files", "2027", "finale", "scenery");
    await mkdir(place, { recursive: true });
    await writeFile(join(place, "curtain.pdf"), "made-up");

    const files = sceneryFileStore({ DATA_DIR: dataDir, DATA_TABLE: "GangshowData" });

    expect(await files.store.list("2027", "finale")).toEqual([{ name: "curtain.pdf", size: 7 }]);
    expect(files.where).toBe(`scenery files in ${join(dataDir, "files")}`);
  });

  it("keeps scenery files in the bucket FILES_BUCKET names, in London", async () => {
    const files = sceneryFileStore({ DATA_DIR: dataDir, FILES_BUCKET: "made-up-files" });

    expect(files.where).toBe("scenery files in bucket made-up-files (eu-west-2)");
  });

  it("says where item notes are kept when a remote table is configured", () => {
    const stores = dataStores({
      DATA_DIR: dataDir,
      DATA_TABLE: "GangshowData",
      DATA_TABLE_REGION: "eu-west-1",
    });

    expect(stores.where).toBe("everything in table GangshowData (eu-west-1)");
  });

  it("uses London, where the table is deployed, unless the table's region is given", () => {
    const env = { DATA_DIR: dataDir, DATA_TABLE: "GangshowData", AWS_REGION: "us-east-1" };

    expect(dataStores(env).where).toContain("(eu-west-2)");
  });
});
