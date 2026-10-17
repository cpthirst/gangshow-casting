import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { behavesAsAnItemNoteStore } from "./item-note-store.contract.ts";
import { fileItemNoteStore, inMemoryItemNoteStore } from "./item-note-store.ts";

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
