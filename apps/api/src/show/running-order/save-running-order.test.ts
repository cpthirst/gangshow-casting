import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunningOrder, type RunningOrderItem } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { outOfGangRemoval, type RemoveOutOfGang } from "#/casting/roles/remove-out-of-gang.ts";
import { inMemoryRoleStore } from "#/casting/roles/role-store.ts";
import { type ItemNoteStore, inMemoryItemNoteStore } from "#/item-notes/item-note-store.ts";
import {
  folderItemFileStore,
  type ItemFileStore,
} from "#/production/item-files/item-file-store.ts";
import type { MicPlotStore } from "#/production/mic-plot/mic-plot-store.ts";
import { inMemoryMicPlotStore } from "#/production/mic-plot/mic-plot-store.ts";
import { inMemoryPropStore, type PropStore } from "#/production/props/prop-store.ts";
import { aCastList, aCastMember } from "#/show/cast/cast.fixture.ts";
import { inMemoryCastStore } from "#/show/cast/cast-store.ts";
import { inMemoryStores } from "#/storage/stores.fixture.ts";
import { anItem, aRunningOrder, itemId, noGangRemoval } from "./running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "./running-order-store.ts";
import { createSaveRunningOrder } from "./save-running-order.ts";

const NOW = new Date("2026-10-12T19:40:00.000Z");

const request = (body: unknown, productionId = "2027") => ({
  pathParameters: { productionId },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

// Saves the given titles (made-up items) in order, with any edits applied. An edit may
// return unknown to send an item the contract refuses.
const update = (
  baseVersion: number,
  first: string[],
  second: string[] = [],
  edit: (item: RunningOrderItem) => unknown = (item) => item,
) => ({
  baseVersion,
  change: {
    type: "update",
    halves: [
      { id: "first-half", items: first.map(anItem).map(edit) },
      { id: "second-half", items: second.map(anItem).map(edit) },
    ],
  },
});

const titlesIn = (body: string | undefined) =>
  RunningOrder.parse(JSON.parse(body ?? "")).halves.map((half) =>
    half.items.map((item) => item.title),
  );

function setUp() {
  const store = inMemoryRunningOrderStore([
    aRunningOrder(6, { first: ["Curtain Up", "Pirate Panic", "Dance One"] }),
  ]);
  const roles = inMemoryRoleStore();
  const itemNotes = inMemoryItemNoteStore();
  const handler = createSaveRunningOrder(store, { roles, itemNotes }, noGangRemoval, () => NOW);
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
    const twentyMinutes = (item: RunningOrderItem): RunningOrderItem =>
      item.title === "Pirate Panic" ? { ...item, minutes: 20, gang: "junior" } : item;

    const res = await handler(
      request(update(6, ["Curtain Up", "Pirate Panic", "Dance One"], [], twentyMinutes)),
    );

    expect(res.statusCode).toBe(201);
    const saved = RunningOrder.parse(JSON.parse(res.body ?? ""));
    const pirates = saved.halves[0].items.find((i) => i.title === "Pirate Panic");
    expect(pirates).toMatchObject({ minutes: 20, gang: "junior" });
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["an off-contract body", { baseVersion: 6, change: { type: "shuffle" } }],
    ["an edit with an empty title", update(6, ["Curtain Up"], [], (i) => ({ ...i, title: "" }))],
    [
      "an edit with negative minutes",
      update(6, ["Curtain Up"], [], (i) => ({ ...i, minutes: -3 })),
    ],
    ["a gang outside the list", update(6, ["Curtain Up"], [], (i) => ({ ...i, gang: "infants" }))],
  ])("rejects %s with 400, saving nothing", async (_case, body) => {
    const { store, handler } = setUp();

    expect((await handler(request(body))).statusCode).toBe(400);
    expect((await store.latest("2027"))?.version).toBe(6);
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
        sceneryNotes: { keepOnlyItems: failing },
        props: { keepOnlyItems: failing },
        propsNotes: { keepOnlyItems: failing },
        sfxFiles: { keepOnlyItems: failing },
        sfxNotes: { keepOnlyItems: failing },
        wardrobeFiles: { keepOnlyItems: failing },
        wardrobeNotes: { keepOnlyItems: failing },
        micPlotNotes: { keepOnlyItems: failing },
        micPlots: { keepOnlyItems: failing },
      },
      noGangRemoval,
      () => NOW,
    );

    const res = await handler(request(update(6, ["Curtain Up", "Pirate Panic"])));

    expect(res.statusCode).toBe(201);
    expect(RunningOrder.parse(JSON.parse(res.body ?? "")).version).toBe(7);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("still removes the other kinds of a cut item's data when one kind fails, and that kind at the next save", async () => {
    const store = inMemoryRunningOrderStore([
      aRunningOrder(6, { first: ["Curtain Up", "Pirate Panic", "Dance One"] }),
    ]);
    const dance = itemId("Dance One");
    const [roles, props, micPlots] = [
      inMemoryRoleStore(),
      inMemoryPropStore(),
      inMemoryMicPlotStore(),
    ];
    await roles.add("2027", dance, { name: "Lead dancer", size: "lead", castMemberIds: [12] });
    await props.add("2027", dance, { name: "Cane", quantity: 1, roleIds: [], carrierIds: [] });
    await micPlots.allocate("2027", dance, 1, 12);
    let propsFail = true;
    const flakyProps = {
      keepOnlyItems: async (productionId: string, itemIds: string[]) => {
        if (propsFail) throw new Error("table unavailable");
        await props.keepOnlyItems(productionId, itemIds);
      },
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createSaveRunningOrder(
      store,
      { roles, props: flakyProps, micPlots },
      noGangRemoval,
      () => NOW,
    );

    const res = await handler(request(update(6, ["Curtain Up", "Pirate Panic"])));

    expect(res.statusCode).toBe(201);
    expect((await roles.list("2027")).roles).toEqual([]);
    expect((await micPlots.list("2027")).items).toEqual([]);
    expect((await props.list("2027")).props).toHaveLength(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("props"));
    log.mockRestore();

    propsFail = false;
    await handler(request(update(7, ["Curtain Up", "Pirate Panic"])));

    expect((await props.list("2027")).props).toEqual([]);
  });

  it("deletes nothing, and logs it, when it can't read the newest version after saving", async () => {
    const saved = inMemoryRunningOrderStore([
      aRunningOrder(6, { first: ["Curtain Up", "Pirate Panic", "Dance One"] }),
    ]);
    let reads = 0;
    const store = {
      ...saved,
      latest: async (productionId: string) => {
        reads += 1;
        if (reads > 1) throw new Error("table unavailable");
        return saved.latest(productionId);
      },
    };
    const roles = inMemoryRoleStore();
    await roles.add("2027", itemId("Dance One"), { name: "Lead", size: "lead", castMemberIds: [] });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createSaveRunningOrder(store, { roles }, noGangRemoval, () => NOW);

    const res = await handler(request(update(6, ["Curtain Up", "Pirate Panic"])));

    expect(res.statusCode).toBe(201);
    expect((await roles.list("2027")).roles).toHaveLength(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("production 2027"));
    log.mockRestore();
  });

  it("cleans up against the newest version, sparing items a later save added", async () => {
    const store = inMemoryRunningOrderStore([
      aRunningOrder(6, { first: ["Curtain Up", "Pirate Panic", "Dance One"] }),
    ]);
    const kept: string[][] = [];
    const keeping = { keepOnlyItems: async (_p: string, ids: string[]) => void kept.push(ids) };
    const casting = { roles: keeping, sceneryFiles: keeping };
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
      noGangRemoval,
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

describe("save running order handler, with an item's gang changed", () => {
  // Pirate Panic casts member 12, in Scouts. Curtain Up, for the Senior gang, still casts
  // member 13, in Beavers, from before items had a gang.
  async function setUpCasting(removal?: RemoveOutOfGang) {
    const runningOrders = inMemoryRunningOrderStore([
      aRunningOrder(6, { first: ["Curtain Up", "Pirate Panic"] }),
    ]);
    const stores = inMemoryStores({
      runningOrders,
      cast: inMemoryCastStore([
        aCastList([aCastMember(12), aCastMember(13, { section: "beavers" })]),
      ]),
    });
    const lead = { name: "Lead", size: "lead" } as const;
    await stores.roles.add("2027", itemId("Pirate Panic"), { ...lead, castMemberIds: [12] });
    await stores.roles.add("2027", itemId("Curtain Up"), { ...lead, castMemberIds: [13] });
    const removeOutOfGang = removal ?? outOfGangRemoval(stores);
    const handler = createSaveRunningOrder(runningOrders, {}, removeOutOfGang, () => NOW);
    const castIn = async (title: string) =>
      (await stores.roles.list("2027")).roles.find((role) => role.itemId === itemId(title))
        ?.castMemberIds;
    return { handler, castIn };
  }
  // The client sends Pirate Panic for the Junior gang, asking nobody.
  const pirateIsJunior = update(6, ["Curtain Up", "Pirate Panic"], [], (item) =>
    item.title === "Pirate Panic" ? { ...item, gang: "junior" } : item,
  );

  it("takes anyone not in the item's new gang out of its roles once saved", async () => {
    const { handler, castIn } = await setUpCasting();

    expect((await handler(request(pirateIsJunior))).statusCode).toBe(201);

    expect(await castIn("Pirate Panic")).toEqual([]);
    expect(await castIn("Curtain Up")).toEqual([13]);
  });

  it("still answers 201 when the removal fails, logging no names", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handler } = await setUpCasting(async () => {
      throw new Error("Sam Example is in role 1");
    });

    expect((await handler(request(pirateIsJunior))).statusCode).toBe(201);

    expect(log).toHaveBeenCalledWith(expect.stringContaining("production 2027"));
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining("Sam"));
    log.mockRestore();
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

  function setUpScenery(sceneryFiles: Pick<ItemFileStore, "keepOnlyItems"> = files()) {
    const store = inMemoryRunningOrderStore([
      aRunningOrder(6, { first: ["Opening Number", "Cut Sketch"] }),
    ]);
    const cleanup = {
      roles: inMemoryRoleStore(),
      itemNotes: inMemoryItemNoteStore(),
      sceneryFiles,
    };
    return createSaveRunningOrder(store, cleanup, noGangRemoval, () => NOW);
  }
  const files = () => folderItemFileStore(folder, "scenery");

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

describe("save running order handler, with SFX files and notes", () => {
  const cut = itemId("Cut Sketch");
  const opening = itemId("Opening Number");
  let folder: string;
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "running-order-sfx-"));
  });
  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  function setUpSfx() {
    const store = inMemoryRunningOrderStore([
      aRunningOrder(6, { first: ["Opening Number", "Cut Sketch"] }),
    ]);
    const sfxNotes = inMemoryItemNoteStore();
    const handler = createSaveRunningOrder(
      store,
      {
        roles: inMemoryRoleStore(),
        itemNotes: inMemoryItemNoteStore(),
        sceneryFiles: folderItemFileStore(folder, "scenery"),
        sfxFiles: folderItemFileStore(folder, "sfx"),
        sfxNotes,
      },
      noGangRemoval,
      () => NOW,
    );
    return { handler, sfxNotes };
  }

  // Put straight into file storage, as an upload would (made-up).
  async function putFile(item: string, department: string, name: string) {
    const file = join(folder, "2027", item, department, name);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, "made-up");
  }
  const sfxNamesOf = async (item: string) =>
    (await folderItemFileStore(folder, "sfx").list("2027", item)).map((file) => file.name);

  it("deletes a removed item's SFX files and SFX note with its scenery files, once the version is saved", async () => {
    const { handler, sfxNotes } = setUpSfx();
    await putFile(cut, "sfx", "boing.mp3");
    await putFile(cut, "scenery", "set-plan.pdf");
    await putFile(opening, "sfx", "thunder.mp3");
    await sfxNotes.save("2027", cut, 0, "Boing on the fall");
    await sfxNotes.save("2027", opening, 0, "Thunder on the second verse");

    const res = await handler(request(update(6, ["Opening Number"])));

    expect(res.statusCode).toBe(201);
    expect(existsSync(join(folder, "2027", cut, "sfx"))).toBe(false);
    expect(existsSync(join(folder, "2027", cut, "scenery"))).toBe(false);
    expect(await sfxNamesOf(opening)).toEqual(["thunder.mp3"]);
    expect((await sfxNotes.list("2027")).notes.map((note) => note.itemId)).toEqual([opening]);
  });

  it("deletes no SFX files or notes when the save is refused, so Reset still undoes a removal", async () => {
    const { handler, sfxNotes } = setUpSfx();
    await putFile(cut, "sfx", "boing.mp3");
    await sfxNotes.save("2027", cut, 0, "Boing on the fall");

    const stale = await handler(request(update(5, ["Opening Number"])));

    expect(stale.statusCode).toBe(409);
    expect(await sfxNamesOf(cut)).toEqual(["boing.mp3"]);
    expect((await sfxNotes.list("2027")).notes).toHaveLength(1);
  });
});

describe("save running order handler, with Wardrobe files and notes", () => {
  const cut = itemId("Cut Sketch");
  const opening = itemId("Opening Number");
  let folder: string;
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "running-order-wardrobe-"));
  });
  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  function setUpWardrobe() {
    const store = inMemoryRunningOrderStore([
      aRunningOrder(6, { first: ["Opening Number", "Cut Sketch"] }),
    ]);
    const wardrobeNotes = inMemoryItemNoteStore();
    const handler = createSaveRunningOrder(
      store,
      {
        roles: inMemoryRoleStore(),
        itemNotes: inMemoryItemNoteStore(),
        sceneryFiles: folderItemFileStore(folder, "scenery"),
        sfxFiles: folderItemFileStore(folder, "sfx"),
        wardrobeFiles: folderItemFileStore(folder, "wardrobe"),
        wardrobeNotes,
      },
      noGangRemoval,
      () => NOW,
    );
    return { handler, wardrobeNotes };
  }

  // Put straight into file storage, as an upload would (made-up).
  async function putFile(item: string, department: string, name: string) {
    const file = join(folder, "2027", item, department, name);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, "made-up");
  }
  const wardrobeNamesOf = async (item: string) =>
    (await folderItemFileStore(folder, "wardrobe").list("2027", item)).map((file) => file.name);

  it("deletes a removed item's Wardrobe files and Wardrobe note with its scenery and SFX files, once the version is saved", async () => {
    const { handler, wardrobeNotes } = setUpWardrobe();
    await putFile(cut, "wardrobe", "hat.jpg");
    await putFile(cut, "scenery", "set-plan.pdf");
    await putFile(cut, "sfx", "boing.mp3");
    await putFile(opening, "wardrobe", "jacket-pattern.pdf");
    await wardrobeNotes.save("2027", cut, 0, "Top hat");
    await wardrobeNotes.save("2027", opening, 0, "Gold jackets for the chorus");

    const res = await handler(request(update(6, ["Opening Number"])));

    expect(res.statusCode).toBe(201);
    expect(existsSync(join(folder, "2027", cut, "wardrobe"))).toBe(false);
    expect(existsSync(join(folder, "2027", cut, "scenery"))).toBe(false);
    expect(existsSync(join(folder, "2027", cut, "sfx"))).toBe(false);
    expect(await wardrobeNamesOf(opening)).toEqual(["jacket-pattern.pdf"]);
    expect((await wardrobeNotes.list("2027")).notes.map((note) => note.itemId)).toEqual([opening]);
  });

  it("deletes no Wardrobe files or notes when the save is refused", async () => {
    const { handler, wardrobeNotes } = setUpWardrobe();
    await putFile(cut, "wardrobe", "hat.jpg");
    await wardrobeNotes.save("2027", cut, 0, "Top hat");

    const stale = await handler(request(update(5, ["Opening Number"])));

    expect(stale.statusCode).toBe(409);
    expect(await wardrobeNamesOf(cut)).toEqual(["hat.jpg"]);
    expect((await wardrobeNotes.list("2027")).notes).toHaveLength(1);
  });
});

describe("save running order handler, with mic plots", () => {
  const old = itemId("Old Sketch");
  const opening = itemId("Opening Number");
  // Made-up cast member id: Alex.
  const alex = 1;

  function setUpMics(micPlots = inMemoryMicPlotStore()) {
    const store = inMemoryRunningOrderStore([
      aRunningOrder(6, { first: ["Opening Number", "Old Sketch"] }),
    ]);
    const micPlotNotes = inMemoryItemNoteStore();
    const cleanup = {
      roles: inMemoryRoleStore(),
      itemNotes: inMemoryItemNoteStore(),
      micPlotNotes,
      micPlots,
    };
    return {
      micPlots,
      micPlotNotes,
      handler: createSaveRunningOrder(store, cleanup, noGangRemoval, () => NOW),
    };
  }
  const itemsWithMics = async (micPlots: MicPlotStore) =>
    (await micPlots.list("2027")).items.map((plot) => plot.itemId);
  const itemsWithNotes = async (notes: ItemNoteStore) =>
    (await notes.list("2027")).notes.map((note) => note.itemId);

  it("deletes a removed item's mic plot once the version is saved, keeping the others'", async () => {
    const { micPlots, handler } = setUpMics();
    await micPlots.allocate("2027", old, 1, alex);
    await micPlots.allocate("2027", opening, 3, alex);

    const res = await handler(request(update(6, ["Opening Number"])));

    expect(res.statusCode).toBe(201);
    expect(await itemsWithMics(micPlots)).toEqual([opening]);
  });

  it("keeps a channel that a reorder puts straight after someone else's, and again on an unchanged save", async () => {
    const { micPlots, handler } = setUpMics();
    // Made-up cast member id: Sam, on Mic 1 in Old Sketch.
    const sam = 2;
    await micPlots.allocate("2027", opening, 1, alex);
    await micPlots.allocate("2027", old, 1, sam);
    const before = (await micPlots.list("2027")).items;

    expect((await handler(request(update(6, ["Old Sketch", "Opening Number"])))).statusCode).toBe(
      201,
    );
    expect((await handler(request(update(7, ["Old Sketch", "Opening Number"])))).statusCode).toBe(
      201,
    );

    expect((await micPlots.list("2027")).items).toEqual(before);
  });

  it("deletes a removed item's Mic plot notes once the version is saved, keeping the others'", async () => {
    const { micPlotNotes, handler } = setUpMics();
    await micPlotNotes.save("2027", old, 0, "Radio mics only");
    await micPlotNotes.save("2027", opening, 0, "Mics 19–24 on for songs only");

    const res = await handler(request(update(6, ["Opening Number"])));

    expect(res.statusCode).toBe(201);
    expect(await itemsWithNotes(micPlotNotes)).toEqual([opening]);
  });

  it("deletes no Mic plot notes when the save is refused", async () => {
    const { micPlotNotes, handler } = setUpMics();
    await micPlotNotes.save("2027", old, 0, "Radio mics only");

    const stale = await handler(request(update(5, ["Opening Number"])));

    expect(stale.statusCode).toBe(409);
    expect(await itemsWithNotes(micPlotNotes)).toEqual([old]);
  });

  it("deletes no mic plot when the save is refused", async () => {
    const { micPlots, handler } = setUpMics();
    await micPlots.allocate("2027", old, 1, alex);

    const stale = await handler(request(update(5, ["Opening Number"])));

    expect(stale.statusCode).toBe(409);
    expect(await itemsWithMics(micPlots)).toEqual([old]);
  });

  it("deletes a removed item's mic plot at the next save when the clean-up failed", async () => {
    const micPlots = inMemoryMicPlotStore();
    await micPlots.allocate("2027", old, 1, alex);
    let failing = true;
    const flaky: MicPlotStore = {
      ...micPlots,
      async keepOnlyItems(productionId, itemIds) {
        if (failing) throw new Error("table unavailable");
        await micPlots.keepOnlyItems(productionId, itemIds);
      },
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handler } = setUpMics(flaky);

    expect((await handler(request(update(6, ["Opening Number"])))).statusCode).toBe(201);
    expect(await itemsWithMics(micPlots)).toEqual([old]);
    failing = false;
    expect((await handler(request(update(7, ["Opening Number"])))).statusCode).toBe(201);

    expect(await itemsWithMics(micPlots)).toEqual([]);
    log.mockRestore();
  });
});

describe("save running order handler, with scenery notes and props", () => {
  const pirate = itemId("Pirate Sketch");
  const opening = itemId("Opening Number");
  const oldFinale = itemId("Old Finale");
  // Made-up cast member id: Alex Smith.
  const alex = 1;

  function setUpProps() {
    const store = inMemoryRunningOrderStore([
      aRunningOrder(6, { first: ["Opening Number", "Pirate Sketch"] }),
    ]);
    const sceneryNotes = inMemoryItemNoteStore();
    const props = inMemoryPropStore();
    const propsNotes = inMemoryItemNoteStore();
    const cleanup = {
      roles: inMemoryRoleStore(),
      itemNotes: inMemoryItemNoteStore(),
      sceneryNotes,
      props,
      propsNotes,
    };
    const handler = createSaveRunningOrder(store, cleanup, noGangRemoval, () => NOW);
    return { sceneryNotes, props, propsNotes, handler };
  }

  async function giveEverything(
    { sceneryNotes, props, propsNotes }: ReturnType<typeof setUpProps>,
    item: string,
  ) {
    await sceneryNotes.save("2027", item, 0, "Two flats and a mast");
    await props.add("2027", item, {
      name: "Cutlass",
      quantity: 1,
      roleIds: [],
      carrierIds: [alex],
    });
    await propsNotes.save("2027", item, 0, "Check the cutlass is blunt");
  }

  const itemsWithNotes = async (notes: ItemNoteStore) =>
    (await notes.list("2027")).notes.map((note) => note.itemId);
  const itemsWithProps = async (props: PropStore) =>
    (await props.list("2027")).props.map((prop) => prop.itemId);

  it("deletes a cut item's scenery notes once the version is saved", async () => {
    const stores = setUpProps();
    await stores.sceneryNotes.save("2027", pirate, 0, "Two flats and a mast");

    const res = await stores.handler(request(update(6, ["Opening Number"])));

    expect(res.statusCode).toBe(201);
    expect(await itemsWithNotes(stores.sceneryNotes)).toEqual([]);
  });

  it("deletes a cut item's props, and who carries them, once the version is saved", async () => {
    const stores = setUpProps();
    await stores.props.add("2027", pirate, {
      name: "Cutlass",
      quantity: 1,
      roleIds: [],
      carrierIds: [alex],
    });

    const res = await stores.handler(request(update(6, ["Opening Number"])));

    expect(res.statusCode).toBe(201);
    expect((await stores.props.list("2027")).props).toEqual([]);
  });

  it("deletes a cut item's props notes once the version is saved", async () => {
    const stores = setUpProps();
    await stores.propsNotes.save("2027", pirate, 0, "Check the cutlass is blunt");

    const res = await stores.handler(request(update(6, ["Opening Number"])));

    expect(res.statusCode).toBe(201);
    expect(await itemsWithNotes(stores.propsNotes)).toEqual([]);
  });

  it("keeps the scenery notes, props and props notes of items still in the show", async () => {
    const stores = setUpProps();
    await giveEverything(stores, pirate);
    await giveEverything(stores, opening);
    const openingProps = (await stores.props.list("2027")).props.filter(
      (prop) => prop.itemId === opening,
    );

    await stores.handler(request(update(6, ["Opening Number"])));

    expect((await stores.sceneryNotes.list("2027")).notes).toEqual([
      { itemId: opening, text: "Two flats and a mast", revision: 1 },
    ]);
    expect((await stores.props.list("2027")).props).toEqual(openingProps);
    expect((await stores.propsNotes.list("2027")).notes).toEqual([
      { itemId: opening, text: "Check the cutlass is blunt", revision: 1 },
    ]);
  });

  it("deletes no scenery notes, props or props notes until a save drops the item", async () => {
    // Reset on the page sends nothing; a refused save is the closest the API sees.
    const stores = setUpProps();
    await giveEverything(stores, pirate);

    const stale = await stores.handler(request(update(5, ["Opening Number"])));

    expect(stale.statusCode).toBe(409);
    expect(await itemsWithNotes(stores.sceneryNotes)).toEqual([pirate]);
    expect(await itemsWithProps(stores.props)).toEqual([pirate]);
    expect(await itemsWithNotes(stores.propsNotes)).toEqual([pirate]);
  });

  it("deletes leftovers of an item cut earlier at the next save, even one with no changes", async () => {
    const stores = setUpProps();
    // Old Finale was cut before cutting took these with it, so they're still stored.
    await giveEverything(stores, oldFinale);

    const res = await stores.handler(request(update(6, ["Opening Number", "Pirate Sketch"])));

    expect(res.statusCode).toBe(201);
    expect(await itemsWithNotes(stores.sceneryNotes)).toEqual([]);
    expect(await itemsWithProps(stores.props)).toEqual([]);
    expect(await itemsWithNotes(stores.propsNotes)).toEqual([]);
  });
});
