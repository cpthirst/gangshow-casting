import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SceneryFileList } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inMemoryRoleStore } from "#/casting/roles/role-store.ts";
import { inMemoryItemNoteStore } from "#/item-notes/item-note-store.ts";
import { anItem, aRunningOrder, itemId } from "#/show/running-order/running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { createSaveRunningOrder } from "#/show/running-order/save-running-order.ts";
import { createListSceneryFiles } from "./list-scenery-files.ts";
import { folderSceneryFileStore } from "./scenery-file-store.ts";

const openingNumber = itemId("Opening Number");
const finale = itemId("Finale");

describe("list scenery files handler", () => {
  let folder: string;
  let list: ReturnType<typeof createListSceneryFiles>;
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "scenery-files-"));
    list = createListSceneryFiles(folderSceneryFileStore(folder));
  });
  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  const placeOf = (item: string) => join(folder, "2027", item, "scenery");

  // Put straight into file storage, as someone could outside the app (made-up files).
  async function putFile(item: string, name: string, size: number) {
    await mkdir(placeOf(item), { recursive: true });
    await writeFile(join(placeOf(item), name), Buffer.alloc(size));
  }

  const request = (item: string, productionId = "2027") => ({
    pathParameters: { productionId, itemId: item },
  });

  async function filesOf(item: string) {
    const res = await list(request(item));
    expect(res.statusCode).toBe(200);
    return SceneryFileList.parse(JSON.parse(res.body ?? "")).files;
  }

  const sortedNames = async (item: string) => (await filesOf(item)).map((file) => file.name).sort();

  it("lists an item's files with their names and sizes", async () => {
    await putFile(openingNumber, "set-plan.pdf", 2_400_000);
    await putFile(openingNumber, "Backdrop.png", 800_000);

    const files = await filesOf(openingNumber);
    expect(files.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: "Backdrop.png", size: 800_000 },
      { name: "set-plan.pdf", size: 2_400_000 },
    ]);
  });

  it("shows a file renamed in storage by its new name only", async () => {
    await putFile(openingNumber, "set-plan.pdf", 10);

    await rename(
      join(placeOf(openingNumber), "set-plan.pdf"),
      join(placeOf(openingNumber), "set-plan-v2.pdf"),
    );

    expect(await sortedNames(openingNumber)).toEqual(["set-plan-v2.pdf"]);
  });

  it("shows a file put in storage outside the app", async () => {
    expect(await filesOf(openingNumber)).toEqual([]);

    await putFile(openingNumber, "lighting.pdf", 10);

    expect(await sortedNames(openingNumber)).toEqual(["lighting.pdf"]);
  });

  it("lists no files for an item that has none", async () => {
    expect(await filesOf(finale)).toEqual([]);
  });

  it("lists only the item's own files", async () => {
    await putFile(openingNumber, "set-plan.pdf", 10);
    await putFile(finale, "curtain.pdf", 10);

    expect(await sortedNames(finale)).toEqual(["curtain.pdf"]);
  });

  it("keeps an item's files with it when it moves in the running order", async () => {
    const runningOrders = inMemoryRunningOrderStore([
      aRunningOrder(1, { first: ["Opening Number", "Pirate Sketch", "Finale"] }),
    ]);
    const save = createSaveRunningOrder(runningOrders, {
      roles: inMemoryRoleStore(),
      itemNotes: inMemoryItemNoteStore(),
    });
    await putFile(openingNumber, "set-plan.pdf", 10);

    const halves = [
      { id: "first-half", items: ["Pirate Sketch", "Finale", "Opening Number"].map(anItem) },
      { id: "second-half", items: [] },
    ];
    const saved = await save({
      pathParameters: { productionId: "2027" },
      body: JSON.stringify({ baseVersion: 1, change: { type: "update", halves } }),
    });

    expect(saved.statusCode).toBe(201);
    const moved = await runningOrders.latest("2027");
    expect(moved?.halves[0].items.map((item) => item.id).indexOf(openingNumber)).toBe(2);
    expect(await sortedNames(openingNumber)).toEqual(["set-plan.pdf"]);
  });

  it("leaves out folders and anything inside them", async () => {
    await putFile(openingNumber, "set-plan.pdf", 10);
    await mkdir(join(placeOf(openingNumber), "old"));
    await writeFile(join(placeOf(openingNumber), "old", "draft.pdf"), "made-up");

    expect(await sortedNames(openingNumber)).toEqual(["set-plan.pdf"]);
  });

  it.each([
    ["a production id that isn't valid", "../etc", openingNumber],
    ["an item id that could reach another folder", "2027", ".."],
    ["an item id with a slash", "2027", "a/b"],
  ])("returns 404 for %s", async (_, productionId, item) => {
    expect((await list(request(item, productionId))).statusCode).toBe(404);
  });
});
