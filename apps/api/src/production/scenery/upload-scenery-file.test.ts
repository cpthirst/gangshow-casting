import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_SCENERY_FILE_BYTES, SceneryUpload } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aRunningOrder, itemId } from "#/show/running-order/running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { folderSceneryFileStore } from "./scenery-file-store.ts";
import { createUploadSceneryFile } from "./upload-scenery-file.ts";

const openingNumber = itemId("Opening Number");
const finale = itemId("Finale");

describe("upload scenery file handler", () => {
  let folder: string;
  let upload: ReturnType<typeof createUploadSceneryFile>;
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "scenery-uploads-"));
    const runningOrders = inMemoryRunningOrderStore([
      aRunningOrder(1, { first: ["Opening Number"], second: ["Finale"] }),
    ]);
    upload = createUploadSceneryFile(folderSceneryFileStore(folder), runningOrders);
  });
  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  const placeOf = (item: string) => join(folder, "2027", item, "scenery");

  // Put straight into file storage, as an earlier upload would have (made-up files).
  async function putFile(item: string, name: string) {
    await mkdir(placeOf(item), { recursive: true });
    await writeFile(join(placeOf(item), name), "made-up");
  }

  const post = (body: unknown, item = openingNumber, productionId = "2027") => ({
    pathParameters: { productionId, itemId: item },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

  const uploadIn = (res: { body?: string | undefined }) =>
    SceneryUpload.parse(JSON.parse(res.body ?? ""));

  it("hands back where to send the file, in the item's place, under its own name", async () => {
    const res = await upload(post({ name: "Set Plan (Act 1).pdf", size: 2_400_000 }));

    expect(res.statusCode).toBe(200);
    expect(uploadIn(res).url).toBe(
      `/api/local-files/2027/${openingNumber}/scenery/Set%20Plan%20(Act%201).pdf`,
    );
  });

  it("accepts a file of exactly 100 MB", async () => {
    const res = await upload(post({ name: "rig.mov", size: MAX_SCENERY_FILE_BYTES }));

    expect(res.statusCode).toBe(200);
  });

  it("refuses a file over 100 MB with 400", async () => {
    const res = await upload(post({ name: "rig.mov", size: MAX_SCENERY_FILE_BYTES + 1 }));

    expect(res.statusCode).toBe(400);
  });

  it("refuses with 409 a name the item already has, leaving the file", async () => {
    await putFile(openingNumber, "set-plan.pdf");

    const res = await upload(post({ name: "set-plan.pdf", size: 1 }));

    expect(res.statusCode).toBe(409);
    expect(await readdir(placeOf(openingNumber))).toEqual(["set-plan.pdf"]);
  });

  it("hands back an upload over a file of the same name when asked to replace it", async () => {
    await putFile(openingNumber, "set-plan.pdf");

    const res = await upload(post({ name: "set-plan.pdf", size: 1, replace: true }));

    expect(res.statusCode).toBe(200);
  });

  it("compares names exactly, so another case is another file", async () => {
    await putFile(openingNumber, "set-plan.pdf");

    expect((await upload(post({ name: "Set-Plan.pdf", size: 1 }))).statusCode).toBe(200);
  });

  it("takes a name another item has as a new file", async () => {
    await putFile(finale, "set-plan.pdf");

    expect((await upload(post({ name: "set-plan.pdf", size: 1 }))).statusCode).toBe(200);
  });

  it.each([
    ["a name reaching into another item's folder", { name: "../Finale/plan.pdf", size: 1 }],
    ["the folder above", { name: "..", size: 1 }],
    ["a name file storage would rewrite to another", { name: "${filename}", size: 1 }],
    ["no size", { name: "set-plan.pdf" }],
    ["anything else", { name: "set-plan.pdf", size: 1, folder: "x" }],
    ["a body that isn't JSON", "set-plan.pdf"],
  ])("refuses %s with 400", async (_, body) => {
    expect((await upload(post(body))).statusCode).toBe(400);
  });

  it("answers 404 for an item that isn't in the latest saved running order", async () => {
    const res = await upload(post({ name: "set-plan.pdf", size: 1 }, itemId("Pirate Sketch")));

    expect(res.statusCode).toBe(404);
  });

  it.each([
    ["an item id that couldn't name a folder", "../finale", "2027"],
    ["a production id that isn't valid", openingNumber, "../2027"],
  ])("answers 404 for %s", async (_, item, productionId) => {
    expect((await upload(post({ name: "a.pdf", size: 1 }, item, productionId))).statusCode).toBe(
      404,
    );
  });
});
