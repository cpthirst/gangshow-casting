import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunningOrder, type RunningOrderItem, type SaveRunningOrderRequest } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inMemoryRoleStore } from "#/casting/roles/role-store.ts";
import { inMemoryItemNoteStore } from "#/item-notes/item-note-store.ts";
import {
  folderSceneryFileStore,
  type SceneryFileStore,
} from "#/production/scenery/scenery-file-store.ts";
import { anItem, aRunningOrder, itemId } from "./running-order.fixture.ts";
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

// A clean-up store with nothing to delete.
const noCleanup = { keepOnlyItems: async () => {} };

function setUp() {
  const store = inMemoryRunningOrderStore([
    aRunningOrder(6, { first: ["Curtain Up", "Pirate Panic", "Dance One"] }),
  ]);
  const roles = inMemoryRoleStore();
  const itemNotes = inMemoryItemNoteStore();
  const handler = createSaveRunningOrder(
    store,
    { roles, itemNotes, sceneryFiles: noCleanup },
    () => NOW,
  );
  return { store, roles, itemNotes, handler };
}

// A new item has no id until the server gives it one.
const aNewItem = (title: string) => {
  const { id: _id, ...item } = anItem(title);
  return item;
};

// Saves the existing items, in order, with a new one added to the end of the second half.
const addEncore = () => ({
  baseVersion: 6,
  change: {
    type: "update",
    halves: [
      { id: "first-half", items: ["Curtain Up", "Pirate Panic", "Dance One"].map(anItem) },
      { id: "second-half", items: [aNewItem("Encore")] },
    ],
  },
});

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

  it("adds a new item with a stable id of its own", async () => {
    const { store, handler } = setUp();

    const res = await handler(request(addEncore()));

    expect(res.statusCode).toBe(201);
    const saved = RunningOrder.parse(JSON.parse(res.body ?? ""));
    expect(saved.version).toBe(7);
    expect(titlesIn(res.body)).toEqual([["Curtain Up", "Pirate Panic", "Dance One"], ["Encore"]]);
    const encore = saved.halves[1].items[0];
    expect(encore?.id).toMatch(/\S/);
    expect(encore?.id).not.toBe(itemId("Encore"));
    expect((await store.latest("2027"))?.halves[1].items[0]?.id).toBe(encore?.id);
  });

  it("removes an item the update leaves out and keeps the old version whole", async () => {
    const { store, handler } = setUp();

    const res = await handler(request(update(6, ["Curtain Up", "Pirate Panic"])));

    expect(res.statusCode).toBe(201);
    expect(titlesIn(res.body)).toEqual([["Curtain Up", "Pirate Panic"], []]);
    expect((await store.get("2027", 6))?.halves[0].items).toHaveLength(3);
  });

  it("adds one item and removes another in the same version", async () => {
    const { handler } = setUp();
    const change = addEncore();
    change.change.halves[0] = {
      id: "first-half",
      items: ["Curtain Up", "Dance One"].map(anItem),
    };

    const res = await handler(request(change));

    expect(res.statusCode).toBe(201);
    expect(titlesIn(res.body)).toEqual([["Curtain Up", "Dance One"], ["Encore"]]);
  });

  it("rejects a new item with no title with 400, saving nothing", async () => {
    const { store, handler } = setUp();
    const change = addEncore();
    change.change.halves[1] = { id: "second-half", items: [{ ...aNewItem("Encore"), title: " " }] };

    const res = await handler(request(change));

    expect(res.statusCode).toBe(400);
    expect((await store.latest("2027"))?.version).toBe(6);
  });

  it("deletes the notes and roles of a removed item once the version is saved", async () => {
    const { roles, itemNotes, handler } = setUp();
    const dance = itemId("Dance One");
    const pirate = itemId("Pirate Panic");
    await roles.add("2027", dance, { name: "Lead dancer", size: "lead", castMemberIds: [12] });
    await roles.add("2027", dance, { name: "Chorus", size: "ensemble", castMemberIds: [] });
    await roles.add("2027", pirate, { name: "Captain", size: "lead", castMemberIds: [13] });
    await itemNotes.save("2027", dance, 0, "Needs tap shoes");
    await itemNotes.save("2027", pirate, 0, "Hat change");

    const res = await handler(request(update(6, ["Curtain Up", "Pirate Panic"])));

    expect(res.statusCode).toBe(201);
    expect((await roles.list("2027")).roles).toEqual([
      { id: 3, itemId: pirate, name: "Captain", size: "lead", castMemberIds: [13], revision: 1 },
    ]);
    expect((await itemNotes.list("2027")).notes).toEqual([
      { itemId: pirate, text: "Hat change", revision: 1 },
    ]);
  });

  it("still answers 201 with the saved version when the clean-up fails", async () => {
    const store = inMemoryRunningOrderStore([
      aRunningOrder(6, { first: ["Curtain Up", "Pirate Panic", "Dance One"] }),
    ]);
    const failing = async () => {
      throw new Error("table unavailable");
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createSaveRunningOrder(
      store,
      {
        roles: { keepOnlyItems: failing },
        itemNotes: { keepOnlyItems: failing },
        sceneryFiles: { keepOnlyItems: failing },
      },
      () => NOW,
    );

    const res = await handler(request(update(6, ["Curtain Up", "Pirate Panic"])));

    expect(res.statusCode).toBe(201);
    expect(RunningOrder.parse(JSON.parse(res.body ?? "")).version).toBe(7);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("cleans up against the newest version, sparing items a later save added", async () => {
    const store = inMemoryRunningOrderStore([
      aRunningOrder(6, { first: ["Curtain Up", "Pirate Panic", "Dance One"] }),
    ]);
    const kept: string[][] = [];
    const keeping = { keepOnlyItems: async (_p: string, ids: string[]) => void kept.push(ids) };
    const casting = { roles: keeping, itemNotes: noCleanup, sceneryFiles: keeping };
    // Someone else saves version 8, with a new item, just after this save writes 7.
    const racing = {
      ...store,
      async save(order: RunningOrder) {
        const result = await store.save(order);
        await store.save(aRunningOrder(8, { first: ["Curtain Up", "Encore"] }));
        return result;
      },
    };

    await createSaveRunningOrder(
      racing,
      casting,
      () => NOW,
    )(request(update(6, ["Curtain Up", "Pirate Panic"])));

    // Roles, then scenery files.
    const newest = [itemId("Curtain Up"), itemId("Encore")];
    expect(kept).toEqual([newest, newest]);
  });

  it("keeps every item's notes and roles when a draft only reorders", async () => {
    const { roles, itemNotes, handler } = setUp();
    await roles.add("2027", itemId("Dance One"), {
      name: "Chorus",
      size: "ensemble",
      castMemberIds: [],
    });
    await itemNotes.save("2027", itemId("Dance One"), 0, "Needs tap shoes");

    await handler(request(update(6, ["Dance One", "Curtain Up", "Pirate Panic"])));

    expect((await roles.list("2027")).roles).toHaveLength(1);
    expect((await itemNotes.list("2027")).notes).toHaveLength(1);
  });

  it("deletes nothing when the draft is stale", async () => {
    const { roles, itemNotes, handler } = setUp();
    await handler(request(update(6, ["Pirate Panic", "Curtain Up", "Dance One"])));
    await roles.add("2027", itemId("Dance One"), {
      name: "Chorus",
      size: "ensemble",
      castMemberIds: [],
    });
    await itemNotes.save("2027", itemId("Dance One"), 0, "Needs tap shoes");

    const res = await handler(request(update(6, ["Curtain Up"])));

    expect(res.statusCode).toBe(409);
    expect((await roles.list("2027")).roles).toHaveLength(1);
    expect((await itemNotes.list("2027")).notes).toHaveLength(1);
  });
});

describe("save running order handler, with scenery files", () => {
  const cut = itemId("Cut Sketch");
  const opening = itemId("Opening Number");
  let folder: string;
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "running-order-scenery-"));
  });
  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  function setUpScenery(sceneryFiles: Pick<SceneryFileStore, "keepOnlyItems"> = files()) {
    const store = inMemoryRunningOrderStore([
      aRunningOrder(6, { first: ["Opening Number", "Cut Sketch"] }),
    ]);
    const cleanup = {
      roles: inMemoryRoleStore(),
      itemNotes: inMemoryItemNoteStore(),
      sceneryFiles,
    };
    return createSaveRunningOrder(store, cleanup, () => NOW);
  }
  const files = () => folderSceneryFileStore(folder);

  // Put straight into file storage, as an upload or someone outside the app would (made-up).
  async function putFile(item: string, name: string, department = "scenery", production = "2027") {
    const file = join(folder, production, item, department, name);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, "made-up");
  }
  const namesOf = async (item: string, production = "2027") =>
    (await files().list(production, item)).map((file) => file.name).sort();

  it("deletes a removed item's scenery files from file storage once the version is saved", async () => {
    const handler = setUpScenery();
    await putFile(cut, "set-plan.pdf");
    await putFile(cut, "backdrop.png");

    const res = await handler(request(update(6, ["Opening Number"])));

    expect(res.statusCode).toBe(201);
    expect(await namesOf(cut)).toEqual([]);
    expect(existsSync(join(folder, "2027", cut, "scenery"))).toBe(false);
  });

  it("keeps the scenery files of the items still in the show", async () => {
    const handler = setUpScenery();
    await putFile(opening, "set-plan.pdf");
    await putFile(cut, "backdrop.png");

    await handler(request(update(6, ["Opening Number"])));

    expect(await namesOf(opening)).toEqual(["set-plan.pdf"]);
  });

  it("deletes no scenery files when the save is refused", async () => {
    const handler = setUpScenery();
    await putFile(cut, "set-plan.pdf");

    // Stale, then a new item with no title: neither saves a version.
    const stale = await handler(request(update(5, ["Opening Number"])));
    const untitled = await handler(request(update(6, ["Opening Number", ""])));

    expect([stale.statusCode, untitled.statusCode]).toEqual([409, 400]);
    expect(await namesOf(cut)).toEqual(["set-plan.pdf"]);
  });

  it("deletes the files on the next save when the clean-up after removing the item failed", async () => {
    let failed = false;
    const failingOnce = {
      async keepOnlyItems(productionId: string, itemIds: string[]) {
        if (!failed) {
          failed = true;
          throw new Error("file storage unavailable");
        }
        await files().keepOnlyItems(productionId, itemIds);
      },
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = setUpScenery(failingOnce);
    await putFile(cut, "set-plan.pdf");

    await handler(request(update(6, ["Opening Number"])));
    expect(await namesOf(cut)).toEqual(["set-plan.pdf"]);
    expect(log).toHaveBeenCalled();
    await handler(request(update(7, ["Opening Number"])));

    expect(await namesOf(cut)).toEqual([]);
    log.mockRestore();
  });

  it("deletes a file put in a removed item's folder after it was removed, on the next save", async () => {
    const handler = setUpScenery();
    await handler(request(update(6, ["Opening Number"])));
    await putFile(cut, "late.pdf");

    await handler(request(update(7, ["Opening Number"])));

    expect(await namesOf(cut)).toEqual([]);
  });

  it("leaves another department's files, and another production's scenery, alone", async () => {
    const handler = setUpScenery();
    await putFile(cut, "thunder.mp3", "sfx");
    await putFile(cut, "set-plan.pdf", "scenery", "2026");

    await handler(request(update(6, ["Opening Number"])));

    expect(existsSync(join(folder, "2027", cut, "sfx", "thunder.mp3"))).toBe(true);
    expect(await namesOf(cut, "2026")).toEqual(["set-plan.pdf"]);
  });
});
