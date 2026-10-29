import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SceneryFileCounts } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { itemId } from "#/show/running-order/running-order.fixture.ts";
import { createCountSceneryFiles } from "./count-scenery-files.ts";
import { folderSceneryFileStore } from "./scenery-file-store.ts";

const openingNumber = itemId("Opening Number");
const finale = itemId("Finale");

describe("count scenery files handler", () => {
  let folder: string;
  let count: ReturnType<typeof createCountSceneryFiles>;
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "scenery-counts-"));
    count = createCountSceneryFiles(folderSceneryFileStore(folder));
  });
  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  // Put straight into file storage, as someone could outside the app (made-up files).
  async function putFile(path: string[]) {
    const file = join(folder, ...path);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, "made-up");
  }
  const putSceneryFiles = (item: string, howMany: number, production = "2027") =>
    Promise.all(
      Array.from({ length: howMany }, (_, i) =>
        putFile([production, item, "scenery", `plan-${i}.pdf`]),
      ),
    );

  async function countsOf(productionId = "2027") {
    const res = await count({ pathParameters: { productionId } });
    expect(res.statusCode).toBe(200);
    return SceneryFileCounts.parse(JSON.parse(res.body ?? "")).counts;
  }

  it("counts each item's scenery files", async () => {
    await putSceneryFiles(openingNumber, 9);
    await putSceneryFiles(finale, 1);

    expect(await countsOf()).toEqual({ [openingNumber]: 9, [finale]: 1 });
  });

  it("counts a file put in storage outside the app on the next ask", async () => {
    await putSceneryFiles(openingNumber, 2);
    expect(await countsOf()).toEqual({ [openingNumber]: 2 });

    await putFile(["2027", openingNumber, "scenery", "extra.pdf"]);

    expect(await countsOf()).toEqual({ [openingNumber]: 3 });
  });

  it("counts only files in each item's own scenery folder, not nested ones or others", async () => {
    await putSceneryFiles(openingNumber, 1);
    await putFile(["2027", openingNumber, "scenery", "old", "set-plan-v1.pdf"]);
    await putFile(["2027", openingNumber, "sfx", "thunder.mp3"]);
    await putSceneryFiles(finale, 1, "2026");

    expect(await countsOf()).toEqual({ [openingNumber]: 1 });
  });

  it("counts nothing for a production with no files", async () => {
    expect(await countsOf()).toEqual({});
  });

  it("answers 404 for a production id that couldn't name a folder", async () => {
    expect((await count({ pathParameters: { productionId: "../etc" } })).statusCode).toBe(404);
  });
});
