import { expect, it } from "vitest";
import type { ItemNoteStore } from "./item-note-store.ts";

/** The rules every item note store keeps, run against each implementation. */
export function behavesAsAnItemNoteStore(make: () => ItemNoteStore) {
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

  it("refuses a save from revision 1 once the notes are at revision 2", async () => {
    const store = make();
    await store.save("2027", "pirate-sketch", 0, "Hat change");
    await store.save("2027", "pirate-sketch", 1, "Hat and coat change");

    expect(await store.save("2027", "pirate-sketch", 1, "Mine")).toBe("stale");
    expect((await store.list("2027")).notes[0]?.text).toBe("Hat and coat change");
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

    // In no particular order (DynamoDB returns them in key order): pages find notes by item id.
    expect((await store.list("2027")).notes.map((note) => note.itemId).sort()).toEqual([
      "finale",
      "pirate-sketch",
    ]);
  });
}
