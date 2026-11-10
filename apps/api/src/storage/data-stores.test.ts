import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  anItem,
  aRunningOrder,
  itemId,
  noGangRemoval,
} from "#/show/running-order/running-order.fixture.ts";
import { createSaveRunningOrder } from "#/show/running-order/save-running-order.ts";
import {
  dataStores,
  fileStores,
  itemCleanupOf,
  itemFileStores,
  remoteStores,
  showWideStores,
  usageStore,
} from "./data-stores.ts";
import { documentClient } from "./dynamo-table.ts";
import { eachKindOf, keptFor, seedEveryKind } from "./item-data.fixture.ts";

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

    const files = itemFileStores({ DATA_DIR: dataDir, DATA_TABLE: "GangshowData" });

    expect(await files.stores.scenery.list("2027", "finale")).toEqual([
      { name: "curtain.pdf", size: 7 },
    ]);
    expect(files.where).toBe(`scenery, SFX and Wardrobe files in ${join(dataDir, "files")}`);
    expect(files.folder).toBe(join(dataDir, "files"));
  });

  it("keeps SFX files beside the scenery files, each in the item's own folder for them", async () => {
    const place = join(dataDir, "files", "2027", "finale", "sfx");
    await mkdir(place, { recursive: true });
    await writeFile(join(place, "thunder.mp3"), "made-up");

    const { stores } = itemFileStores({ DATA_DIR: dataDir });

    expect(await stores.sfx.list("2027", "finale")).toEqual([{ name: "thunder.mp3", size: 7 }]);
    expect(await stores.scenery.list("2027", "finale")).toEqual([]);
  });

  it("keeps Wardrobe files beside the others, in the item's own folder for them", async () => {
    const place = join(dataDir, "files", "2027", "finale", "wardrobe");
    await mkdir(place, { recursive: true });
    await writeFile(join(place, "jacket-pattern.pdf"), "made-up");

    const { stores } = itemFileStores({ DATA_DIR: dataDir });

    expect(await stores.wardrobe.list("2027", "finale")).toEqual([
      { name: "jacket-pattern.pdf", size: 7 },
    ]);
    expect(await stores.sfx.list("2027", "finale")).toEqual([]);
  });

  it("keeps scenery files in the bucket FILES_BUCKET names, in London", async () => {
    const files = itemFileStores({ DATA_DIR: dataDir, FILES_BUCKET: "made-up-files" });

    expect(files.where).toBe("scenery, SFX and Wardrobe files in bucket made-up-files (eu-west-2)");
    expect(files.folder).toBeUndefined();
  });

  it("keeps SFX notes in their own local file, apart from the scenery notes", async () => {
    const stores = dataStores({ DATA_DIR: dataDir });

    await stores.sfxNotes.save("2027", "finale", 0, "Thunder on the second verse");

    const file = JSON.parse(await readFile(join(dataDir, "2027", "sfx-notes.json"), "utf8"));
    expect(file.notes).toEqual([
      { itemId: "finale", text: "Thunder on the second verse", revision: 1 },
    ]);
    expect((await stores.sceneryNotes.list("2027")).notes).toEqual([]);
  });

  it("keeps Wardrobe notes in their own local file, apart from the others", async () => {
    const stores = dataStores({ DATA_DIR: dataDir });

    await stores.wardrobeNotes.save("2027", "finale", 0, "Gold jackets for the chorus");

    const file = JSON.parse(await readFile(join(dataDir, "2027", "wardrobe-notes.json"), "utf8"));
    expect(file.notes).toEqual([
      { itemId: "finale", text: "Gold jackets for the chorus", revision: 1 },
    ]);
    expect((await stores.sfxNotes.list("2027")).notes).toEqual([]);
  });

  it("keeps Mic plot notes in their own local file, apart from the others", async () => {
    const stores = dataStores({ DATA_DIR: dataDir });

    await stores.micPlotNotes.save("2027", "finale", 0, "Mics 19–24 on for songs only");

    const file = JSON.parse(await readFile(join(dataDir, "2027", "mic-plot-notes.json"), "utf8"));
    expect(file.notes).toEqual([
      { itemId: "finale", text: "Mics 19–24 on for songs only", revision: 1 },
    ]);
    expect((await stores.sfxNotes.list("2027")).notes).toEqual([]);
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

  it("removes every kind of data a cut item has, keeping the other items'", async () => {
    const stores = fileStores(dataDir);
    const { stores: files, folder } = itemFileStores({ DATA_DIR: dataDir });
    if (folder === undefined) throw new Error("expected local files");
    const [opening, pirate] = [itemId("Opening Number"), itemId("Pirate Sketch")];
    await stores.runningOrders.save(
      aRunningOrder(1, { first: ["Opening Number", "Pirate Sketch"] }),
    );
    await seedEveryKind(stores, folder, "2027", opening);
    await seedEveryKind(stores, folder, "2027", pirate);
    const cleanup = itemCleanupOf(stores, files);
    const save = createSaveRunningOrder(stores.runningOrders, cleanup, noGangRemoval);

    const res = await save({
      pathParameters: { productionId: "2027" },
      body: JSON.stringify({
        baseVersion: 1,
        change: {
          type: "update",
          halves: [
            { id: "first-half", items: [anItem("Opening Number")] },
            { id: "second-half", items: [] },
          ],
        },
      }),
    });

    expect(res.statusCode).toBe(201);
    expect(await keptFor(stores, files, "2027", pirate)).toEqual(eachKindOf(cleanup, 0));
    expect(await keptFor(stores, files, "2027", opening)).toEqual(eachKindOf(cleanup, 1));
  });

  it("removes, when an item is cut, from every store but the show-wide ones, locally and in the remote table", () => {
    const { stores: files } = itemFileStores({ DATA_DIR: dataDir });
    const db = documentClient(new DynamoDBClient({ region: "eu-west-2" }));

    for (const stores of [fileStores(dataDir), remoteStores(db, "GangshowData")]) {
      const cleanup = itemCleanupOf(stores, files);
      const perItem = Object.keys(stores).filter((kind) => !showWideKinds.has(kind));

      expect(Object.keys(cleanup).filter((kind) => showWideKinds.has(kind))).toEqual([]);
      expect(Object.values(cleanup)).toEqual([
        ...perItem.map((kind) => Reflect.get(stores, kind)),
        files.scenery,
        files.sfx,
        files.wardrobe,
      ]);
    }
  });
});

const showWideKinds = new Set<string>(showWideStores);
