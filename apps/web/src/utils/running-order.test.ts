import type { RunningOrder, RunningOrderItem } from "@app/shared";
import { describe, expect, it } from "vitest";
import { anItem, aRunningOrder } from "./running-order.fixture.ts";
import {
  dropItem,
  formatTime,
  formFor,
  type ItemForm,
  itemFrom,
  neighboursOf,
  placeOf,
  positionOf,
  replaceItem,
} from "./running-order.ts";

describe("formatTime", () => {
  it.each([
    [19 * 60 + 15, "7:15 pm"],
    [20 * 60 + 22, "8:22 pm"],
    [12 * 60 + 5, "12:05 pm"],
    [9 * 60, "9:00 am"],
    [0, "12:00 am"],
    [24 * 60 + 10, "12:10 am"],
  ])("shows %i minutes after midnight as %s", (minutes, expected) => {
    expect(formatTime(minutes)).toBe(expected);
  });
});

describe("dropItem", () => {
  const item = (title: string): RunningOrderItem => ({
    id: `itm_${title}`,
    title,
    cast: "",
    stage: ["full"],
    leads: "",
    comments: "",
    minutes: 5,
    printed: true,
  });
  const order = (first: string[], second: string[]): RunningOrder => ({
    productionId: "2027",
    title: "Gang Show 2027",
    version: 6,
    savedAt: "2026-10-04T00:00:00.000Z",
    startTime: "19:15",
    intervalMinutes: 20,
    halves: [
      { id: "first-half", name: "First half", items: first.map(item) },
      { id: "second-half", name: "Second half", items: second.map(item) },
    ],
  });
  const titles = (result: RunningOrder) =>
    result.halves.map((half) => half.items.map((i) => i.title));

  it("moves an item up within its half", () => {
    expect(titles(dropItem(order(["A", "B", "C"], []), "itm_C", 0, 0))).toEqual([
      ["C", "A", "B"],
      [],
    ]);
  });

  it("moves an item down within its half", () => {
    expect(titles(dropItem(order(["A", "B", "C"], []), "itm_A", 0, 2))).toEqual([
      ["B", "C", "A"],
      [],
    ]);
  });

  it("moves an item across the interval to a given position", () => {
    expect(titles(dropItem(order(["A", "B"], ["C"]), "itm_C", 0, 1))).toEqual([
      ["A", "C", "B"],
      [],
    ]);
  });

  it("drops into an empty half", () => {
    expect(titles(dropItem(order(["A", "B"], []), "itm_A", 1, 0))).toEqual([["B"], ["A"]]);
  });

  it("leaves the order alone for an unknown item", () => {
    const before = order(["A"], ["B"]);
    expect(dropItem(before, "itm_missing", 1, 0)).toBe(before);
  });
});

describe("item form", () => {
  const pirates: RunningOrderItem = {
    id: "itm_pirates",
    title: "Pirate Panic",
    cast: "Cubs + Beavers",
    stage: ["apron", "full", "apron"],
    leads: "Sam / Alex",
    comments: "Performed to track",
    minutes: 18,
    printed: true,
  };

  it("round-trips an item through the form unchanged", () => {
    expect(itemFrom(formFor(pirates), pirates.id)).toEqual({ ok: true, item: pirates });
  });

  it("round-trips an item with no stage set", () => {
    const noStage = { ...pirates, stage: [] };

    expect(itemFrom(formFor(noStage), noStage.id)).toEqual({ ok: true, item: noStage });
  });

  it("reads blank minutes as untimed and trims text", () => {
    const result = itemFrom({ ...formFor(pirates), minutes: " ", title: "  Pirate Panic " }, "id");

    expect(result.ok && result.item.minutes).toBeNull();
    expect(result.ok && result.item.title).toBe("Pirate Panic");
  });

  const badInput: [keyof ItemForm, Partial<ItemForm>, string][] = [
    ["title", { title: " " }, "Enter a title (up to 120 characters)."],
    ["minutes", { minutes: "-3" }, "Enter whole minutes from 0 to 240, or leave it blank."],
    ["minutes", { minutes: "ten" }, "Enter whole minutes from 0 to 240, or leave it blank."],
    ["minutes", { minutes: "2.5" }, "Enter whole minutes from 0 to 240, or leave it blank."],
    ["comments", { comments: "x".repeat(501) }, "Keep this to 500 characters or fewer."],
  ];

  it.each(badInput)("explains a bad %s", (field, change, message) => {
    const result = itemFrom({ ...formFor(pirates), ...change }, pirates.id);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[field]).toBe(message);
  });
});

describe("replaceItem", () => {
  const item = (title: string): RunningOrderItem => ({
    id: `itm_${title}`,
    title,
    cast: "",
    stage: ["full"],
    leads: "",
    comments: "",
    minutes: 5,
    printed: true,
  });
  const order: RunningOrder = {
    productionId: "2027",
    title: "Gang Show 2027",
    version: 6,
    savedAt: "2026-10-04T00:00:00.000Z",
    startTime: "19:15",
    intervalMinutes: 20,
    halves: [
      { id: "first-half", name: "First half", items: [item("A"), item("B")] },
      { id: "second-half", name: "Second half", items: [item("C")] },
    ],
  };

  it("swaps in the edited item, in place, in whichever half it's in", () => {
    const edited = { ...item("C"), minutes: 9 };

    const result = replaceItem(order, edited);

    expect(result.halves[1].items).toEqual([edited]);
    expect(result.halves[0].items).toEqual(order.halves[0].items);
  });
});

describe("placeOf", () => {
  const order = aRunningOrder(
    [anItem("Opening Number"), anItem("Mystery Act", { printed: false }), anItem("Pirate Sketch")],
    [anItem("Campfire Song")],
  );

  it("gives an item's programme number and half", () => {
    expect(placeOf(order, "pirate-sketch")).toMatchObject({
      item: { title: "Pirate Sketch" },
      half: { name: "First half" },
      number: 2,
    });
    expect(placeOf(order, "campfire-song")).toMatchObject({
      half: { name: "Second half" },
      number: 1,
    });
  });

  it("gives no number to an item that isn't in the printed programme", () => {
    expect(placeOf(order, "mystery-act")?.number).toBeNull();
  });

  it("finds nothing for an item that isn't in the running order", () => {
    expect(placeOf(order, "no-such-item")).toBeUndefined();
  });
});

describe("positionOf", () => {
  const order = aRunningOrder(
    [anItem("Opening Number"), anItem("Pirate Sketch")],
    [anItem("Mystery Act", { printed: false })],
  );
  const positionOfItem = (itemId: string) => {
    const place = placeOf(order, itemId);
    return place && positionOf(place);
  };

  it("names the item's number and half", () => {
    expect(positionOfItem("pirate-sketch")).toBe("Item 2 · First half");
  });

  it("names only the half for an item not in the printed programme", () => {
    expect(positionOfItem("mystery-act")).toBe("Second half · Not in printed programme");
  });
});

describe("neighboursOf", () => {
  const order = aRunningOrder(
    [anItem("Opening Number"), anItem("Pirate Sketch")],
    [anItem("Campfire Song"), anItem("Finale")],
  );
  const titles = (itemId: string) => {
    const { previous, next } = neighboursOf(order, itemId);
    return [previous?.title, next?.title];
  };

  it("gives the items either side, in running order", () => {
    expect(titles("pirate-sketch")).toEqual(["Opening Number", "Campfire Song"]);
  });

  it("carries on across the interval", () => {
    expect(titles("campfire-song")).toEqual(["Pirate Sketch", "Finale"]);
  });

  it("has nothing before the first item or after the last", () => {
    expect(titles("opening-number")).toEqual([undefined, "Pirate Sketch"]);
    expect(titles("finale")).toEqual(["Campfire Song", undefined]);
  });

  it("has no neighbours for an item that isn't in the running order", () => {
    expect(titles("no-such-item")).toEqual([undefined, undefined]);
  });
});
