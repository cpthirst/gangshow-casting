import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { itemId } from "#/show/running-order/running-order.fixture.ts";
import { createDeleteSceneryFile } from "./delete-scenery-file.ts";
import { folderSceneryFileStore } from "./scenery-file-store.ts";

const openingNumber = itemId("Opening Number");
const finale = itemId("Finale");

describe("delete scenery file handler", () => {
  let folder: string;
  let deleteFile: ReturnType<typeof createDeleteSceneryFile>;
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "scenery-deletes-"));
    deleteFile = createDeleteSceneryFile(folderSceneryFileStore(folder));
  });
  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  const placeOf = (item: string) => join(folder, "2027", item, "scenery");

  // Put straight into file storage, as someone could outside the app (made-up files).
  async function putFile(item: string, name: string) {
    await mkdir(placeOf(item), { recursive: true });
    await writeFile(join(placeOf(item), name), "made-up");
  }

  const namesIn = async (item: string) => (await readdir(placeOf(item))).sort();

  const request = (name: string | undefined, item = openingNumber, productionId = "2027") => ({
    pathParameters: { productionId, itemId: item },
    ...(name === undefined ? {} : { queryStringParameters: { name } }),
  });

  it("deletes the item's file from storage, leaving its others", async () => {
    await putFile(openingNumber, "set-plan.pdf");
    await putFile(openingNumber, "build-list.xlsx");

    const res = await deleteFile(request("set-plan.pdf"));

    expect(res.statusCode).toBe(204);
    expect(await namesIn(openingNumber)).toEqual(["build-list.xlsx"]);
  });

  it("answers 404 for a file that's already gone", async () => {
    await putFile(openingNumber, "build-list.xlsx");

    expect((await deleteFile(request("set-plan.pdf"))).statusCode).toBe(404);
    expect(await namesIn(openingNumber)).toEqual(["build-list.xlsx"]);
  });

  it("answers 404 for an item with no files", async () => {
    expect((await deleteFile(request("set-plan.pdf"))).statusCode).toBe(404);
  });

  it("never deletes another item's file of the same name", async () => {
    await putFile(finale, "curtain.pdf");

    expect((await deleteFile(request("curtain.pdf"))).statusCode).toBe(404);
    expect(await namesIn(finale)).toEqual(["curtain.pdf"]);
  });

  it.each([
    ["no name", undefined],
    ["a name reaching into another item's folder", "../Finale/curtain.pdf"],
    ["a name reaching into another item's scenery", `../../${finale}/scenery/curtain.pdf`],
    ["the folder above", ".."],
  ])("refuses %s with 400, deleting nothing", async (_, name) => {
    await putFile(finale, "curtain.pdf");

    expect((await deleteFile(request(name))).statusCode).toBe(400);
    expect(await namesIn(finale)).toEqual(["curtain.pdf"]);
  });

  it("answers 404 for an item id that couldn't name a folder, deleting nothing", async () => {
    await putFile(finale, "curtain.pdf");

    expect((await deleteFile(request("curtain.pdf", `../${finale}`))).statusCode).toBe(404);
    expect(await namesIn(finale)).toEqual(["curtain.pdf"]);
  });
});
