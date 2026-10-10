import { RunningOrder, type RunningOrderItem, type SaveRunningOrderRequest } from "@app/shared";
import { describe, expect, it } from "vitest";
import { anItem, aRunningOrder } from "./running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "./running-order-store.ts";
import { createSaveRunningOrder } from "./save-running-order.ts";

const NOW = new Date("2026-10-12T19:40:00.000Z");

const request = (body: unknown, productionId = "2027") => ({
  pathParameters: { productionId },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

// Saves the given titles (made-up items) in order, with any edits applied.
const update = (
  baseVersion: number,
  first: string[],
  second: string[] = [],
  edit: (item: RunningOrderItem) => RunningOrderItem = (item) => item,
) =>
  ({
    baseVersion,
    change: {
      type: "update",
      halves: [
        { id: "first-half", items: first.map(anItem).map(edit) },
        { id: "second-half", items: second.map(anItem).map(edit) },
      ],
    },
  }) satisfies SaveRunningOrderRequest;

const titlesIn = (body: string | undefined) =>
  RunningOrder.parse(JSON.parse(body ?? "")).halves.map((half) =>
    half.items.map((item) => item.title),
  );

function setUp() {
  const store = inMemoryRunningOrderStore([
    aRunningOrder(6, { first: ["Curtain Up", "Pirate Panic", "Dance One"] }),
  ]);
  return { store, handler: createSaveRunningOrder(store, () => NOW) };
}

describe("save running order handler", () => {
  it("saves a reordered draft as the next version and keeps the old one", async () => {
    const { store, handler } = setUp();

    const res = await handler(request(update(6, ["Pirate Panic", "Curtain Up", "Dance One"])));

    expect(res.statusCode).toBe(201);
    const saved = RunningOrder.parse(JSON.parse(res.body ?? ""));
    expect(saved.version).toBe(7);
    expect(saved.savedAt).toBe(NOW.toISOString());
    expect(titlesIn(res.body)).toEqual([["Pirate Panic", "Curtain Up", "Dance One"], []]);
    expect((await store.latest("2027"))?.version).toBe(7);
    expect(await store.get("2027", 6)).toEqual(
      aRunningOrder(6, { first: ["Curtain Up", "Pirate Panic", "Dance One"] }),
    );
  });

  it("rejects a stale base version with 409 and the latest version, saving nothing", async () => {
    const { store, handler } = setUp();
    await handler(request(update(6, ["Pirate Panic", "Curtain Up", "Dance One"])));

    const res = await handler(request(update(6, ["Dance One", "Curtain Up", "Pirate Panic"])));

    expect(res.statusCode).toBe(409);
    expect(RunningOrder.parse(JSON.parse(res.body ?? "")).version).toBe(7);
    expect((await store.latest("2027"))?.version).toBe(7);
  });

  it.each([
    ["loses an item", update(6, ["Curtain Up", "Pirate Panic"])],
    ["duplicates an item", update(6, ["Curtain Up", "Curtain Up", "Pirate Panic", "Dance One"])],
    ["invents an item", update(6, ["Curtain Up", "Pirate Panic", "Dance One", "Encore"])],
  ])("rejects an update that %s with 400, saving nothing", async (_case, body) => {
    const { store, handler } = setUp();

    const res = await handler(request(body));

    expect(res.statusCode).toBe(400);
    expect((await store.latest("2027"))?.version).toBe(6);
  });

  it("saves edited item details as the next version", async () => {
    const { handler } = setUp();
    const twentyMinutes = (item: RunningOrderItem) =>
      item.title === "Pirate Panic" ? { ...item, minutes: 20 } : item;

    const res = await handler(
      request(update(6, ["Curtain Up", "Pirate Panic", "Dance One"], [], twentyMinutes)),
    );

    expect(res.statusCode).toBe(201);
    const saved = RunningOrder.parse(JSON.parse(res.body ?? ""));
    expect(saved.halves[0].items.find((i) => i.title === "Pirate Panic")?.minutes).toBe(20);
  });

  it.each([
    ["an empty title", (item: RunningOrderItem) => ({ ...item, title: "" })],
    ["negative minutes", (item: RunningOrderItem) => ({ ...item, minutes: -3 })],
  ])("rejects an edit with %s with 400, saving nothing", async (_case, edit) => {
    const { store, handler } = setUp();

    const res = await handler(
      request(update(6, ["Curtain Up", "Pirate Panic", "Dance One"], [], edit)),
    );

    expect(res.statusCode).toBe(400);
    expect((await store.latest("2027"))?.version).toBe(6);
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["an off-contract body", { baseVersion: 6, change: { type: "shuffle" } }],
  ])("rejects %s with 400", async (_case, body) => {
    const { handler } = setUp();

    expect((await handler(request(body))).statusCode).toBe(400);
  });

  it("returns 404 for a production with nothing stored", async () => {
    const { handler } = setUp();

    const res = await handler(request(update(1, []), "1999"));

    expect(res.statusCode).toBe(404);
  });
});
