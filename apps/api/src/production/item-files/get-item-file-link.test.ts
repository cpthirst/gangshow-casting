import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ItemFileLink } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { itemId } from "#/show/running-order/running-order.fixture.ts";
import { createGetItemFileLink } from "./get-item-file-link.ts";
import { folderItemFileStore } from "./item-file-store.ts";

const openingNumber = itemId("Opening Number");

describe("scenery file link handler", () => {
  let folder: string;
  let getLink: ReturnType<typeof createGetItemFileLink>;
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "scenery-links-"));
    getLink = createGetItemFileLink(folderItemFileStore(folder, "scenery"));
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

  const downloadRequest = (name: string) => ({
    pathParameters: { productionId: "2027", itemId: openingNumber },
    queryStringParameters: { name, download: "true" },
  });

  it("answers with a link to the item's file", async () => {
    await putFile(openingNumber, "set-plan.pdf");

    const res = await getLink(request("set-plan.pdf"));

    expect(res.statusCode).toBe(200);
    expect(ItemFileLink.parse(JSON.parse(res.body ?? ""))).toEqual({
      url: `/api/local-files/2027/${openingNumber}/scenery/set-plan.pdf`,
    });
    // Anyone holding the link can use it for a while, so nothing on the way may keep it.
    expect(res.headers?.["cache-control"]).toBe("no-store");
  });

  it("answers with a link that downloads the item's file, when asked for one", async () => {
    await putFile(openingNumber, "set-plan.jpg");

    const res = await getLink(downloadRequest("set-plan.jpg"));

    expect(res.statusCode).toBe(200);
    expect(ItemFileLink.parse(JSON.parse(res.body ?? ""))).toEqual({
      url: `/api/local-files/2027/${openingNumber}/scenery/set-plan.jpg?download=true`,
    });
  });

  it("answers 400 for a download asked for any other way", async () => {
    await putFile(openingNumber, "set-plan.jpg");

    const res = await getLink({
      pathParameters: { productionId: "2027", itemId: openingNumber },
      queryStringParameters: { name: "set-plan.jpg", download: "yes" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("answers 404 for a download of a name not on the item", async () => {
    await putFile(openingNumber, "set-plan.jpg");

    expect((await getLink(downloadRequest("wings.webp"))).statusCode).toBe(404);
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
