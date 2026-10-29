import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SceneryFileLink } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { itemId } from "#/show/running-order/running-order.fixture.ts";
import { createGetSceneryFileLink } from "./get-scenery-file-link.ts";
import { folderSceneryFileStore } from "./scenery-file-store.ts";

const openingNumber = itemId("Opening Number");

describe("scenery file link handler", () => {
  let folder: string;
  let getLink: ReturnType<typeof createGetSceneryFileLink>;
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "scenery-links-"));
    getLink = createGetSceneryFileLink(folderSceneryFileStore(folder));
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

  const request = (name: string | undefined, item = openingNumber, productionId = "2027") => ({
    pathParameters: { productionId, itemId: item },
    ...(name === undefined ? {} : { queryStringParameters: { name } }),
  });

  it("answers with a link to the item's file", async () => {
    await putFile(openingNumber, "set-plan.pdf");

    const res = await getLink(request("set-plan.pdf"));

    expect(res.statusCode).toBe(200);
    expect(SceneryFileLink.parse(JSON.parse(res.body ?? ""))).toEqual({
      url: `/api/local-files/2027/${openingNumber}/scenery/set-plan.pdf`,
    });
    // Anyone holding the link can use it for a while, so nothing on the way may keep it.
    expect(res.headers?.["cache-control"]).toBe("no-store");
  });

  it("links a file renamed in storage by its new name, and the old name to nothing", async () => {
    await putFile(openingNumber, "build-list.xlsx");
    await rename(
      join(placeOf(openingNumber), "build-list.xlsx"),
      join(placeOf(openingNumber), "build-list-v2.xlsx"),
    );

    expect((await getLink(request("build-list-v2.xlsx"))).statusCode).toBe(200);
    expect((await getLink(request("build-list.xlsx"))).statusCode).toBe(404);
  });

  it("answers 404 for a file that isn't there any more", async () => {
    expect((await getLink(request("set-plan.pdf"))).statusCode).toBe(404);
  });

  it("never links another item's file", async () => {
    await putFile(itemId("Finale"), "curtain.pdf");

    expect((await getLink(request("curtain.pdf"))).statusCode).toBe(404);
  });

  it.each([
    ["no name", undefined],
    ["a name reaching outside the item's folder", "../../finale/scenery/curtain.pdf"],
    ["the folder above", ".."],
  ])("answers 400 for %s", async (_, name) => {
    expect((await getLink(request(name))).statusCode).toBe(400);
  });

  it("answers 404 for an item id that couldn't name a folder", async () => {
    expect((await getLink(request("set-plan.pdf", "../finale"))).statusCode).toBe(404);
  });
});
