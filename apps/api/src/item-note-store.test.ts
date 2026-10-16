import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileItemNoteStore, type ItemNoteStore, inMemoryItemNoteStore } from "./item-note-store.ts";

function behavesAsAnItemNoteStore(make: () => ItemNoteStore) {
  it("has no notes for a production nobody has written any for", async () => {
    expect(await make().list("2027")).toEqual({ productionId: "2027", notes: [] });
  });

  it("saves an item's first notes from revision 0", async () => {
    const store = make();

    const saved = await store.save("2027", "pirate-sketch", 0, "Hat change");

    expect(saved).toEqual({ itemId: "pirate-sketch", text: "Hat change", revision: 1 });
    expect((await store.list("2027")).notes).toEqual([saved]);
  });

  it("replaces an item's notes at the revision they were read at", async () => {
    const store = make();
    await store.save("2027", "pirate-sketch", 0, "Hat change");

    const saved = await store.save("2027", "pirate-sketch", 1, "Hat and coat change");

    expect(saved).toEqual({ itemId: "pirate-sketch", text: "Hat and coat change", revision: 2 });
    expect((await store.list("2027")).notes).toEqual([saved]);
  });

  it("refuses a save based on an older revision", async () => {
    const store = make();
    await store.save("2027", "pirate-sketch", 0, "Hat change");

    expect(await store.save("2027", "pirate-sketch", 0, "Mine")).toBe("stale");
    expect((await store.list("2027")).notes[0]?.text).toBe("Hat change");
  });

  it("keeps cleared notes as empty text, so later stale saves are still caught", async () => {
    const store = make();
    await store.save("2027", "pirate-sketch", 0, "Hat change");

    expect(await store.save("2027", "pirate-sketch", 1, "")).toEqual({
      itemId: "pirate-sketch",
      text: "",
      revision: 2,
    });
    expect(await store.save("2027", "pirate-sketch", 1, "Late")).toBe("stale");
  });

  it("keeps each item's notes apart", async () => {
    const store = make();
    await store.save("2027", "pirate-sketch", 0, "Hat change");
    await store.save("2027", "finale", 0, "Everyone on");

    expect((await store.list("2027")).notes.map((note) => note.itemId)).toEqual([
      "pirate-sketch",
      "finale",
    ]);
  });
}

describe("in-memory item note store", () => {
  behavesAsAnItemNoteStore(() => inMemoryItemNoteStore());
});

describe("file item note store", () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "item-notes-"));
  });
  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  behavesAsAnItemNoteStore(() => fileItemNoteStore(dataDir));

  it("keeps notes in an owner-only file per production", async () => {
    await fileItemNoteStore(dataDir).save("2027", "pirate-sketch", 0, "Hat change");

    const path = join(dataDir, "2027", "item-notes.json");
    expect(JSON.parse(await readFile(path, "utf8")).notes).toHaveLength(1);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it("reads notes saved by an earlier run", async () => {
    await fileItemNoteStore(dataDir).save("2027", "pirate-sketch", 0, "Hat change");

    expect((await fileItemNoteStore(dataDir).list("2027")).notes[0]?.text).toBe("Hat change");
  });

  it("refuses a production id that isn't a safe folder name", async () => {
    await expect(fileItemNoteStore(dataDir).list("../etc")).rejects.toThrow();
  });
});
