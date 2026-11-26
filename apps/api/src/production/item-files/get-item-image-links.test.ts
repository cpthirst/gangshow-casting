import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ItemImageLinks } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aRunningOrder, itemId } from "#/show/running-order/running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { createGetItemImageLinks } from "./get-item-image-links.ts";
import { folderItemFileStore } from "./item-file-store.ts";

const openingNumber = itemId("Opening Number");

describe("image links handler", () => {
  let folder: string;
  let getLinks: ReturnType<typeof createGetItemImageLinks>;
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "image-links-"));
    getLinks = createGetItemImageLinks(
      folderItemFileStore(folder, "scenery"),
      inMemoryRunningOrderStore([aRunningOrder(1, { first: ["Opening Number", "Finale"] })]),
    );
  });
  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  // Put straight into file storage, as someone could outside the app (made-up files).
  async function putFile(item: string, name: string, department = "scenery") {
    const place = join(folder, "2027", item, department);
    await mkdir(place, { recursive: true });
    await writeFile(join(place, name), "made-up");
  }

  const request = (item = openingNumber, productionId = "2027") => ({
    pathParameters: { productionId, itemId: item },
  });

  it("answers with a link to each of the item's images, and none to its other files", async () => {
    for (const name of ["backdrop.png", "build-list.pdf", "set-plan.jpg", "logo.svg"]) {
      await putFile(openingNumber, name);
    }

    const res = await getLinks(request());

    expect(res.statusCode).toBe(200);
    const { links } = ItemImageLinks.parse(JSON.parse(res.body ?? ""));
    expect(links.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: "backdrop.png", url: `/api/local-files/2027/${openingNumber}/scenery/backdrop.png` },
      { name: "set-plan.jpg", url: `/api/local-files/2027/${openingNumber}/scenery/set-plan.jpg` },
    ]);
    // Anyone holding the links can use them for a while, so nothing on the way may keep them.
    expect(res.headers?.["cache-control"]).toBe("no-store");
  });

  it("links only the department's own images", async () => {
    await putFile(openingNumber, "dress-design.png", "wardrobe");

    const res = await getLinks(request());

    expect(ItemImageLinks.parse(JSON.parse(res.body ?? "")).links).toEqual([]);
  });

  it("leaves out an image deleted between listing the files and linking it", async () => {
    await putFile(openingNumber, "backdrop.png");
    await putFile(openingNumber, "set-plan.jpg");
    const store = folderItemFileStore(folder, "scenery");
    const getLinksMeanwhile = createGetItemImageLinks(
      {
        ...store,
        linkTo: async (productionId, item, name) =>
          name === "set-plan.jpg" ? undefined : store.linkTo(productionId, item, name),
      },
      inMemoryRunningOrderStore([aRunningOrder(1, { first: ["Opening Number"] })]),
    );

    const res = await getLinksMeanwhile(request());

    const { links } = ItemImageLinks.parse(JSON.parse(res.body ?? ""));
    expect(links.map(({ name }) => name)).toEqual(["backdrop.png"]);
  });

  it("answers 404 for an item not in the latest saved running order", async () => {
    const cut = itemId("Interval Act");
    await putFile(cut, "backdrop.png");

    expect((await getLinks(request(cut))).statusCode).toBe(404);
  });

  it.each([
    ["a production id that isn't valid", "../etc", openingNumber],
    ["an item id that could reach another folder", "2027", ".."],
  ])("answers 404 for %s", async (_, productionId, item) => {
    expect((await getLinks(request(item, productionId))).statusCode).toBe(404);
  });
});
