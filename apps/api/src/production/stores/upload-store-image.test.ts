import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ItemFileUpload, MAX_ITEM_FILE_BYTES } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { putStoreImages } from "./store-image.fixture.ts";
import { folderStoreImageStore } from "./store-image-store.ts";
import { createUploadStoreImage } from "./upload-store-image.ts";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "store-uploads-"));
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

const upload = (store: string, body: unknown) =>
  createUploadStoreImage(folderStoreImageStore(folder))({
    pathParameters: { storeId: store },
    body: JSON.stringify(body),
  });

describe("uploading an image to a store", () => {
  it("hands back where to send the image, in the store's own folder, under its own name", async () => {
    const res = await upload("scenery", { name: "castle-backdrop.png", size: 2_400_000 });

    expect(res.statusCode).toBe(200);
    expect(ItemFileUpload.parse(JSON.parse(res.body ?? "")).url).toBe(
      "/api/local-files/stores/scenery/castle-backdrop.png",
    );
  });

  it.each(["build-list.pdf", "logo.svg", "notes"])(
    "refuses %s with 400, as it isn't an image the store keeps, giving no form to send it with",
    async (name) => {
      const res = await upload("scenery", { name, size: 1 });

      expect(res.statusCode).toBe(400);
      expect(res.body).toBeUndefined();
    },
  );

  it("refuses an image over 100 MB with 400", async () => {
    const res = await upload("scenery", { name: "castle.jpg", size: MAX_ITEM_FILE_BYTES + 1 });

    expect(res.statusCode).toBe(400);
  });

  it("refuses with 409 a name the store already has, unless asked to replace it", async () => {
    await putStoreImages(folder, "scenery", "throne.jpg");

    const kept = await upload("scenery", { name: "throne.jpg", size: 1 });
    const replaced = await upload("scenery", { name: "throne.jpg", size: 1, replace: true });

    expect(kept.statusCode).toBe(409);
    expect(replaced.statusCode).toBe(200);
  });

  it("answers 404 for a department with no store", async () => {
    expect((await upload("sfx", { name: "thunder.png", size: 1 })).statusCode).toBe(404);
  });

  it("answers 400 for a name that could reach another folder", async () => {
    expect((await upload("scenery", { name: "../props/crown.png", size: 1 })).statusCode).toBe(400);
  });
});
