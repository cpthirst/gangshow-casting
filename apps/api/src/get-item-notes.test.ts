import { ItemNoteList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createGetItemNotes } from "./get-item-notes.ts";
import { inMemoryItemNoteStore } from "./item-note-store.ts";
import { aRunningOrder, itemId } from "./running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "./running-order-store.ts";
import { createSaveItemNote } from "./save-item-note.ts";

const pirateSketch = itemId("Pirate Sketch");

function setUp() {
  const notes = inMemoryItemNoteStore();
  const runningOrders = inMemoryRunningOrderStore([
    aRunningOrder(7, { first: ["Opening Number", "Pirate Sketch"] }),
  ]);
  return {
    notes,
    get: createGetItemNotes(notes),
    save: createSaveItemNote(notes, runningOrders),
  };
}

const put = (body: unknown, item = pirateSketch, productionId = "2027") => ({
  pathParameters: { productionId, itemId: item },
  body: JSON.stringify(body),
});

describe("get item notes handler", () => {
  it("returns every item's notes", async () => {
    const { get, save } = setUp();
    await save(put({ text: "Hat change", revision: 0 }));

    const res = await get({ pathParameters: { productionId: "2027" } });

    expect(res.statusCode).toBe(200);
    expect(ItemNoteList.parse(JSON.parse(res.body ?? ""))).toEqual({
      productionId: "2027",
      notes: [{ itemId: pirateSketch, text: "Hat change", revision: 1 }],
    });
  });

  it("returns 404 for a production id that isn't valid", async () => {
    const { get } = setUp();

    expect((await get({ pathParameters: { productionId: "../etc" } })).statusCode).toBe(404);
  });
});
