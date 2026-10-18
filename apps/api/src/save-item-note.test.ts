import { ItemNote, ItemNoteList, type SaveRunningOrderRequest } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createGetItemNotes } from "./get-item-notes.ts";
import { inMemoryItemNoteStore } from "./item-note-store.ts";
import { inMemoryRoleStore } from "./role-store.ts";
import { anItem, aRunningOrder, itemId } from "./running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "./running-order-store.ts";
import { createSaveItemNote } from "./save-item-note.ts";
import { createSaveRunningOrder } from "./save-running-order.ts";

const pirateSketch = itemId("Pirate Sketch");

function setUp() {
  const notes = inMemoryItemNoteStore();
  const runningOrders = inMemoryRunningOrderStore([
    aRunningOrder(7, { first: ["Opening Number", "Pirate Sketch"] }),
  ]);
  return { notes, save: createSaveItemNote(notes, runningOrders) };
}

const put = (body: unknown, item = pirateSketch, productionId = "2027") => ({
  pathParameters: { productionId, itemId: item },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

describe("save item notes handler", () => {
  it("returns 200 with the saved notes, trimmed, at the next revision", async () => {
    const { save } = setUp();

    const res = await save(put({ text: "  Hat change  ", revision: 0 }));

    expect(res.statusCode).toBe(200);
    expect(ItemNote.parse(JSON.parse(res.body ?? ""))).toEqual({
      itemId: pirateSketch,
      text: "Hat change",
      revision: 1,
    });
  });

  it("returns 409 when the notes were saved by someone else since", async () => {
    const { save } = setUp();
    await save(put({ text: "Theirs", revision: 0 }));

    expect((await save(put({ text: "Mine", revision: 0 }))).statusCode).toBe(409);
  });

  it.each([
    ["over 500 characters", { text: "x".repeat(501), revision: 0 }],
    ["no revision", { text: "Hat change" }],
    ["an unknown field", { text: "Hat change", revision: 0, author: "x" }],
    ["not JSON", "{"],
  ])("returns 400 for %s, saving nothing", async (_case, body) => {
    const { save, notes } = setUp();

    expect((await save(put(body))).statusCode).toBe(400);
    expect((await notes.list("2027")).notes).toEqual([]);
  });

  it("returns 404 for an item that isn't in the latest running order", async () => {
    const { save } = setUp();

    expect((await save(put({ text: "Hat change", revision: 0 }, "cut-item"))).statusCode).toBe(404);
  });

  it("returns 404 for an item id that isn't a valid id", async () => {
    const { save } = setUp();

    expect((await save(put({ text: "x", revision: 0 }, "x".repeat(41)))).statusCode).toBe(404);
  });

  it("returns 404 for a production id that isn't valid", async () => {
    const { save } = setUp();

    expect((await save(put({ text: "x", revision: 0 }, pirateSketch, "../etc"))).statusCode).toBe(
      404,
    );
  });
});

describe("item notes across running-order versions", () => {
  it("keeps an item's notes, at the same revision, when a new running order moves it", async () => {
    const notes = inMemoryItemNoteStore();
    const runningOrders = inMemoryRunningOrderStore([
      aRunningOrder(7, { first: ["Opening Number", "Pirate Sketch"] }),
    ]);
    const save = createSaveItemNote(notes, runningOrders);
    const saveOrder = createSaveRunningOrder(runningOrders, {
      roles: inMemoryRoleStore(),
      itemNotes: notes,
    });
    await save(put({ text: "Hat change", revision: 0 }));

    // Pirate Sketch moves to the start of the second half: version 8.
    const moved = {
      baseVersion: 7,
      change: {
        type: "update",
        halves: [
          { id: "first-half", items: [anItem("Opening Number")] },
          { id: "second-half", items: [anItem("Pirate Sketch")] },
        ],
      },
    } satisfies SaveRunningOrderRequest;
    const saved = await saveOrder({
      pathParameters: { productionId: "2027" },
      body: JSON.stringify(moved),
    });
    expect(saved.statusCode).toBe(201);

    const listed = await createGetItemNotes(notes)({ pathParameters: { productionId: "2027" } });
    expect(ItemNoteList.parse(JSON.parse(listed.body ?? "")).notes).toEqual([
      { itemId: pirateSketch, text: "Hat change", revision: 1 },
    ]);
    expect((await save(put({ text: "Hat and coat", revision: 1 }))).statusCode).toBe(200);
  });
});
