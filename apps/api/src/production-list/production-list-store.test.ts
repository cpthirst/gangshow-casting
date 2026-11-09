import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { behavesAsAProductionListStore } from "./production-list-store.contract.ts";
import {
  fileProductionListStore,
  inMemoryProductionListStore,
  PRODUCTIONS_FILE,
} from "./production-list-store.ts";

describe("in-memory production list store", () => {
  behavesAsAProductionListStore(async (productions) => inMemoryProductionListStore(productions));
});

describe("file production list store", () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "production-list-"));
  });
  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  behavesAsAProductionListStore(async (productions) => {
    if (productions) {
      await writeFile(join(dataDir, PRODUCTIONS_FILE), JSON.stringify({ productions }));
    }
    return fileProductionListStore(dataDir);
  });

  it("refuses to erase a folder that isn't a production's, removing nothing", async () => {
    await mkdir(join(dataDir, "files", "2027"), { recursive: true });
    await writeFile(join(dataDir, "files", "2027", "made-up.pdf"), "made-up");

    await expect(fileProductionListStore(dataDir).eraseData("files")).rejects.toThrow(
      "Invalid production id",
    );

    expect(await readdir(join(dataDir, "files", "2027"))).toEqual(["made-up.pdf"]);
  });

  it("writes 2027 to the data folder the first time the list is read", async () => {
    await fileProductionListStore(dataDir).list();

    const file = JSON.parse(await readFile(join(dataDir, PRODUCTIONS_FILE), "utf8"));
    expect(file).toEqual({ productions: ["2027"] });
  });
});
