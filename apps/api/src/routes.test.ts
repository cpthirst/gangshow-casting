import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileDepartments, ItemImageLinks, isAccountRoute, routeKeys } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { folderItemFileStore } from "#/production/item-files/item-file-store.ts";
import { putStoreImages } from "#/production/stores/store-image.fixture.ts";
import { folderStoreImageStore } from "#/production/stores/store-image-store.ts";
import { aRunningOrder, itemId } from "#/show/running-order/running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { inMemoryStores, noItemFiles, noStoreImages } from "#/storage/stores.fixture.ts";
import { inMemoryUsageStore } from "#/usage/usage-store.ts";
import { createRoutes, routes } from "./routes.ts";

describe("the routes table", () => {
  it("has a handler for exactly the shared route list's routes, but for the account routes", () => {
    const dataKeys = routeKeys.filter((key) => !isAccountRoute(key));

    expect(Object.keys(routes).sort()).toEqual(dataKeys.sort());
  });

  describe("each file department's image links", () => {
    const opening = itemId("Opening Number");
    let folder: string;
    beforeEach(async () => {
      folder = await mkdtemp(join(tmpdir(), "routes-images-"));
    });
    afterEach(async () => {
      await rm(folder, { recursive: true, force: true });
    });

    it.each(fileDepartments)("links only %s's own images", async (department) => {
      for (const each of fileDepartments) {
        const place = join(folder, "2027", opening, each);
        await mkdir(place, { recursive: true });
        await writeFile(join(place, `${each}.png`), "made-up");
        await writeFile(join(place, `${each}.pdf`), "made-up");
      }
      const table = createRoutes(
        inMemoryStores({
          runningOrders: inMemoryRunningOrderStore([
            aRunningOrder(1, { first: ["Opening Number"] }),
          ]),
        }),
        inMemoryUsageStore(),
        {
          scenery: folderItemFileStore(folder, "scenery"),
          sfx: folderItemFileStore(folder, "sfx"),
          wardrobe: folderItemFileStore(folder, "wardrobe"),
        },
        noStoreImages,
      );

      const res = await table[
        `GET /api/productions/{productionId}/items/{itemId}/${department}-image-links`
      ]({ pathParameters: { productionId: "2027", itemId: opening } });

      expect(
        ItemImageLinks.parse(JSON.parse(res.body ?? "")).links.map(({ name }) => name),
      ).toEqual([`${department}.png`]);
    });
  });

  it("links a store's images through its route, on the stores' own image store", async () => {
    const folder = await mkdtemp(join(tmpdir(), "routes-stores-"));
    await putStoreImages(folder, "scenery", "throne.jpg");
    const table = createRoutes(
      inMemoryStores(),
      inMemoryUsageStore(),
      noItemFiles,
      folderStoreImageStore(folder),
    );

    const res = await table["GET /api/stores/{storeId}/image-links"]({
      pathParameters: { storeId: "scenery" },
    });
    await rm(folder, { recursive: true, force: true });

    expect(ItemImageLinks.parse(JSON.parse(res.body ?? "")).links.map(({ name }) => name)).toEqual([
      "throne.jpg",
    ]);
  });
});
