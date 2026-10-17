import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aCastList, aCastMember, jo } from "./cast.fixture.ts";
import { behavesAsACastStore } from "./cast-store.contract.ts";
import { fileCastStore, inMemoryCastStore, readCastFile } from "./cast-store.ts";

describe("in-memory cast store", () => {
  behavesAsACastStore(async (initial) => inMemoryCastStore(initial));
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

  behavesAsACastStore(async (initial = []) => {
    for (const list of initial) await writeCast(list.productionId, list);
    return fileCastStore(dataDir);
  });

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

  it("adds a member with the next id, saved to the file", async () => {
    await writeCast("2027", aCastList([aCastMember(1), aCastMember(56)]));
    const store = fileCastStore(dataDir);

    const added = await store.add("2027", { ...jo });

    expect(added?.id).toBe(57);
    expect((await fileCastStore(dataDir).list("2027"))?.members.map((m) => m.id)).toEqual([
      1, 56, 57,
    ]);
  });

  it("never reuses an id: it carries on from the stored next id", async () => {
    await writeCast("2027", { ...aCastList([aCastMember(1)]), nextId: 60 });

    expect((await fileCastStore(dataDir).add("2027", { ...jo }))?.id).toBe(60);
    expect((await fileCastStore(dataDir).add("2027", { ...jo }))?.id).toBe(61);
  });

  it("gives simultaneous adds different ids and keeps both", async () => {
    await writeCast("2027", aCastList([aCastMember(1)]));
    const store = fileCastStore(dataDir);

    const [a, b] = await Promise.all([store.add("2027", { ...jo }), store.add("2027", { ...jo })]);

    expect(new Set([a?.id, b?.id]).size).toBe(2);
    expect((await store.list("2027"))?.members).toHaveLength(3);
  });

  it("leaves no temporary files behind", async () => {
    await writeCast("2027", aCastList([aCastMember(1)]));

    await fileCastStore(dataDir).add("2027", { ...jo });

    const file = await readFile(join(dataDir, "2027", "cast.json"), "utf8");
    expect(JSON.parse(file).members).toHaveLength(2);
    expect(await readdir(join(dataDir, "2027"))).toEqual(["cast.json"]);
  });

  it("adds nothing to a production with no cast file", async () => {
    expect(await fileCastStore(dataDir).add("1999", { ...jo })).toBeUndefined();
  });

  it("never gives out an id that's already taken, even if the stored next id is stale", async () => {
    await writeCast("2027", { ...aCastList([aCastMember(1), aCastMember(56)]), nextId: 10 });

    expect((await fileCastStore(dataDir).add("2027", { ...jo }))?.id).toBe(57);
  });

  it("removes a member's details from the file entirely", async () => {
    await writeCast(
      "2027",
      aCastList([aCastMember(1), aCastMember(2, { firstName: "Zed", lastName: "Gone" })]),
    );

    expect(await fileCastStore(dataDir).remove("2027", 2, 1)).toBe("removed");

    const file = await readFile(join(dataDir, "2027", "cast.json"), "utf8");
    expect(file).not.toMatch(/Zed|Gone/);
    expect(await readdir(join(dataDir, "2027"))).toEqual(["cast.json"]);
  });

  it("never gives a deleted member's id to someone new", async () => {
    await writeCast("2027", aCastList([aCastMember(1), aCastMember(2)]));
    const store = fileCastStore(dataDir);

    await store.remove("2027", 2, 1);
    const added = await store.add("2027", { ...jo });

    expect(added?.id).toBe(3);
  });

  it("refuses to remove at a stale revision, keeping the member", async () => {
    await writeCast("2027", aCastList([aCastMember(2, { revision: 4 })]));

    expect(await fileCastStore(dataDir).remove("2027", 2, 3)).toBe("stale");
    expect((await fileCastStore(dataDir).list("2027"))?.members).toHaveLength(1);
  });

  it("sweeps away temp copies left by an earlier crash when it next saves", async () => {
    await writeCast("2027", aCastList([aCastMember(1)]));
    await writeFile(join(dataDir, "2027", ".cast-leftover.tmp"), "an old copy with names");

    await fileCastStore(dataDir).add("2027", { ...jo });

    expect(await readdir(join(dataDir, "2027"))).toEqual(["cast.json"]);
  });

  it("saves an update to the file, keeping the id", async () => {
    await writeCast("2027", aCastList([aCastMember(12, { revision: 3 }), aCastMember(13)]));

    await fileCastStore(dataDir).update("2027", 12, 3, { ...jo });

    const members = (await fileCastStore(dataDir).list("2027"))?.members;
    expect(members?.find((m) => m.id === 12)).toEqual({ ...jo, id: 12, revision: 4 });
    expect(members).toHaveLength(2);
  });

  it("refuses a stale update, leaving the file alone", async () => {
    await writeCast("2027", aCastList([aCastMember(12, { revision: 4 })]));

    expect(await fileCastStore(dataDir).update("2027", 12, 3, { ...jo })).toBe("stale");
    expect((await fileCastStore(dataDir).list("2027"))?.members[0]?.firstName).toBe("Sam");
  });
});

describe("readCastFile", () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "cast-read-"));
  });
  afterEach(() => rm(dataDir, { recursive: true, force: true }));

  it("gives a production's cast list and the next id it would hand out", async () => {
    const list = aCastList([aCastMember(1), aCastMember(56)]);
    await mkdir(join(dataDir, "2027"), { recursive: true });
    await writeFile(join(dataDir, "2027", "cast.json"), JSON.stringify({ ...list, nextId: 60 }));

    expect(await readCastFile(dataDir, "2027")).toEqual({ list, nextId: 60 });
  });

  it("gives nothing for a production with no cast file", async () => {
    expect(await readCastFile(dataDir, "2027")).toBeUndefined();
  });
});
