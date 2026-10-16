import { describe, expect, it } from "vitest";
import { ItemNote, ItemNoteList, SaveItemNoteRequest } from "./item-note.ts";

describe("ItemNote", () => {
  it("is an item's notes text, with a revision", () => {
    const note = { itemId: "pirate-sketch", text: "Hook needs a hat change", revision: 2 };
    expect(ItemNote.parse(note)).toEqual(note);
  });

  it("refuses unknown fields", () => {
    expect(
      ItemNote.safeParse({ itemId: "pirate-sketch", text: "", revision: 1, author: "x" }).success,
    ).toBe(false);
  });
});

describe("ItemNoteList", () => {
  it("is a production's notes", () => {
    expect(ItemNoteList.parse({ productionId: "2027", notes: [] })).toEqual({
      productionId: "2027",
      notes: [],
    });
  });
});

describe("SaveItemNoteRequest", () => {
  it("trims the text, and allows it empty to clear the notes", () => {
    expect(SaveItemNoteRequest.parse({ text: "  Smoke cue  ", revision: 0 })).toEqual({
      text: "Smoke cue",
      revision: 0,
    });
    expect(SaveItemNoteRequest.parse({ text: "", revision: 3 }).text).toBe("");
  });

  it("allows up to 500 characters", () => {
    expect(SaveItemNoteRequest.safeParse({ text: "x".repeat(500), revision: 0 }).success).toBe(
      true,
    );
    expect(SaveItemNoteRequest.safeParse({ text: "x".repeat(501), revision: 0 }).success).toBe(
      false,
    );
  });

  it("needs the revision the change is based on", () => {
    expect(SaveItemNoteRequest.safeParse({ text: "Smoke cue" }).success).toBe(false);
  });
});
