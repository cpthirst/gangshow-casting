import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { storeFolderOf } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDeleteStoreImage } from "./delete-store-image.ts";
import { putStoreImages } from "./store-image.fixture.ts";
import { folderStoreImageStore } from "./store-image-store.ts";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "store-removals-"));
  await putStoreImages(folder, "scenery", "castle-backdrop.png", "throne.jpg");
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

const remove = (store: string, name: string | undefined) =>
  createDeleteStoreImage(folderStoreImageStore(folder))({
    pathParameters: { storeId: store },
    ...(name === undefined ? {} : { queryStringParameters: { name } }),
  });
const namesIn = async () => (await readdir(join(folder, storeFolderOf("scenery")))).sort();

describe("removing an image from a store", () => {
  it("deletes the image from the store for good, leaving its others", async () => {
    const res = await remove("scenery", "throne.jpg");

    expect(res.statusCode).toBe(204);
    expect(await namesIn()).toEqual(["castle-backdrop.png"]);
  });

  it("answers 404 for an image already removed, so the page can say so", async () => {
    await remove("scenery", "throne.jpg");

    expect((await remove("scenery", "throne.jpg")).statusCode).toBe(404);
  });

  it("answers 404 for a department with no store", async () => {
    expect((await remove("sfx", "throne.jpg")).statusCode).toBe(404);
  });

  it.each([undefined, "../props/crown.png"])(
    "answers 400 for the name %s, which no image in the store can have, deleting nothing",
    async (name) => {
      expect((await remove("scenery", name)).statusCode).toBe(400);
      expect(await namesIn()).toEqual(["castle-backdrop.png", "throne.jpg"]);
    },
  );
});
