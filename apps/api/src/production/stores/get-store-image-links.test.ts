import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ItemFileLink, ItemImageLinks } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGetStoreImageLink } from "./get-store-image-link.ts";
import { createGetStoreImageLinks } from "./get-store-image-links.ts";
import { putStoreImages } from "./store-image.fixture.ts";
import { folderStoreImageStore } from "./store-image-store.ts";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "store-images-"));
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

const linksOf = (store: string) =>
  createGetStoreImageLinks(folderStoreImageStore(folder))({ pathParameters: { storeId: store } });

describe("a store's image links", () => {
  it("answers with a link to each of the store's images, and none to its other files", async () => {
    await putStoreImages(
      folder,
      "scenery",
      "throne.jpg",
      "castle-backdrop.png",
      "build-list.pdf",
      "logo.svg",
    );

    const res = await linksOf("scenery");

    expect(res.statusCode).toBe(200);
    const { links } = ItemImageLinks.parse(JSON.parse(res.body ?? ""));
    expect(links.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: "castle-backdrop.png", url: "/api/local-files/stores/scenery/castle-backdrop.png" },
      { name: "throne.jpg", url: "/api/local-files/stores/scenery/throne.jpg" },
    ]);
    // Anyone holding the links can use them for a while, so nothing on the way may keep them.
    expect(res.headers?.["cache-control"]).toBe("no-store");
  });

  it("links only the store's own images, apart from the others' and every production's", async () => {
    await putStoreImages(folder, "props", "crown.png");
    await mkdir(join(folder, "2027", "opening-number", "scenery"), { recursive: true });
    await writeFile(join(folder, "2027", "opening-number", "scenery", "set-plan.jpg"), "made-up");

    const res = await linksOf("scenery");

    expect(ItemImageLinks.parse(JSON.parse(res.body ?? "")).links).toEqual([]);
  });

  it.each(["sfx", "mic-plot", "..", "stores"])(
    "answers 404 for %j, which has no store",
    async (store) => {
      expect((await linksOf(store)).statusCode).toBe(404);
    },
  );
});

describe("a link to one of a store's images", () => {
  const linkTo = (store: string, query: Record<string, string>) =>
    createGetStoreImageLink(folderStoreImageStore(folder))({
      pathParameters: { storeId: store },
      queryStringParameters: query,
    });

  it("links to the image, or to saving it when asked to download", async () => {
    await putStoreImages(folder, "wardrobe", "pirate-coat.jpg");

    const opened = await linkTo("wardrobe", { name: "pirate-coat.jpg" });
    const saved = await linkTo("wardrobe", { name: "pirate-coat.jpg", download: "true" });

    expect(ItemFileLink.parse(JSON.parse(opened.body ?? "")).url).toBe(
      "/api/local-files/stores/wardrobe/pirate-coat.jpg",
    );
    expect(ItemFileLink.parse(JSON.parse(saved.body ?? "")).url).toBe(
      "/api/local-files/stores/wardrobe/pirate-coat.jpg?download=true",
    );
    expect(opened.headers?.["cache-control"]).toBe("no-store");
  });

  it("answers 404 for an image that isn't there, or a store there isn't", async () => {
    await putStoreImages(folder, "scenery", "throne.jpg");

    expect((await linkTo("props", { name: "throne.jpg" })).statusCode).toBe(404);
    expect((await linkTo("sfx", { name: "throne.jpg" })).statusCode).toBe(404);
  });

  it("answers 404 for a file in the store that isn't an image", async () => {
    await putStoreImages(folder, "scenery", "build-list.pdf");

    expect((await linkTo("scenery", { name: "build-list.pdf" })).statusCode).toBe(404);
  });

  it("answers 400 for a name that could reach another folder", async () => {
    expect((await linkTo("scenery", { name: "../props/crown.png" })).statusCode).toBe(400);
  });
});
