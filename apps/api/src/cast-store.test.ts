import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import { fileCastStore, inMemoryCastStore } from "./cast-store.ts";

describe("in-memory cast store", () => {
  it("returns a production's cast list", async () => {
    const list = aCastList([aCastMember(1)]);

    expect(await inMemoryCastStore([list]).list("2027")).toEqual(list);
  });

  it("returns nothing for a production with no cast", async () => {
    expect(await inMemoryCastStore().list("2027")).toBeUndefined();
  });
});

describe("file cast store", () => {
  let dataDir: string;
  const writeCast = async (productionId: string, content: unknown) => {
    await mkdir(join(dataDir, productionId), { recursive: true });
    await writeFile(join(dataDir, productionId, "cast.json"), JSON.stringify(content));
  };

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "cast-"));
  });
  afterEach(() => rm(dataDir, { recursive: true, force: true }));

  it("reads a production's cast list", async () => {
    const list = aCastList([aCastMember(1), aCastMember(2, { firstName: "Alex" })]);
    await writeCast("2027", list);

    expect(await fileCastStore(dataDir).list("2027")).toEqual(list);
  });

  it("returns nothing for a production with no cast file", async () => {
    expect(await fileCastStore(dataDir).list("1999")).toBeUndefined();
  });

  it("refuses production ids that could reach outside the data folder", async () => {
    await expect(fileCastStore(dataDir).list("../etc")).rejects.toThrow(/invalid production id/i);
  });

  it("rejects a stored file holding fields beyond the cast schema", async () => {
    const member = { ...aCastMember(1), dateOfBirth: "2012-01-01" };
    await writeCast("2027", { productionId: "2027", members: [member] });

    await expect(fileCastStore(dataDir).list("2027")).rejects.toThrow();
  });

  it("never echoes a corrupt file's contents (which could include names) in its error", async () => {
    await mkdir(join(dataDir, "2027"), { recursive: true });
    // Not JSON at all: Node's parse error would quote this text.
    await writeFile(join(dataDir, "2027", "cast.json"), "Sam Example, 1st Somewhere");

    const error = await fileCastStore(dataDir)
      .list("2027")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toMatch(/Sam|Exampl/);
    expect(error instanceof Error && error.cause).toBeUndefined();
  });

  it("refuses a cast file that belongs to a different production", async () => {
    await writeCast("2027", aCastList([aCastMember(1)], "2026"));

    await expect(fileCastStore(dataDir).list("2027")).rejects.toThrow();
  });
});
