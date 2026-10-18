import { describe, expect, it } from "vitest";
import { ProductionId, RunningOrder, SaveRunningOrderRequest } from "./running-order.ts";

const item = {
  id: "itm_curtain-up",
  title: "Curtain Up",
  cast: "Full Senior Gang",
  stage: ["full"],
  leads: "Sam / Alex",
  comments: "",
  minutes: 5,
  printed: true,
};

const runningOrder = {
  productionId: "2027",
  title: "Gang Show 2027",
  version: 6,
  savedAt: "2026-10-04T00:00:00.000Z",
  startTime: "19:15",
  intervalMinutes: 20,
  halves: [
    { id: "first-half", name: "First half", items: [item] },
    { id: "second-half", name: "Second half", items: [] },
  ],
};

describe("RunningOrder", () => {
  it("accepts a running order with two halves", () => {
    expect(RunningOrder.parse(runningOrder)).toEqual(runningOrder);
  });

  it("accepts an item with no timing and a stage sequence", () => {
    const untimed = { ...item, minutes: null, stage: ["apron", "full", "apron"] };
    const parsed = RunningOrder.parse({
      ...runningOrder,
      halves: [{ ...runningOrder.halves[0], items: [untimed] }, runningOrder.halves[1]],
    });

    expect(parsed.halves[0].items[0]?.minutes).toBeNull();
  });

  it.each([
    ["an empty title", { title: "  " }],
    ["an unknown stage", { stage: ["balcony"] }],
    ["negative minutes", { minutes: -3 }],
    ["fractional minutes", { minutes: 2.5 }],
    ["an over-long title", { title: "x".repeat(121) }],
  ])("rejects an item with %s", (_case, change) => {
    const bad = { ...item, ...change };

    expect(() =>
      RunningOrder.parse({
        ...runningOrder,
        halves: [{ ...runningOrder.halves[0], items: [bad] }, runningOrder.halves[1]],
      }),
    ).toThrow();
  });

  it("rejects a running order without exactly two halves", () => {
    expect(() =>
      RunningOrder.parse({ ...runningOrder, halves: [runningOrder.halves[0]] }),
    ).toThrow();
  });
});

describe("ProductionId", () => {
  it("accepts a simple id", () => {
    expect(ProductionId.parse("2027")).toBe("2027");
  });

  it.each(["../etc", "a/b", "", "x".repeat(41)])("rejects %j", (id) => {
    expect(ProductionId.safeParse(id).success).toBe(false);
  });
});

describe("SaveRunningOrderRequest", () => {
  const update = {
    type: "update",
    halves: [
      { id: "first-half", items: [item] },
      { id: "second-half", items: [] },
    ],
  };

  it("accepts an update carrying every item, in order, with its details", () => {
    expect(SaveRunningOrderRequest.parse({ baseVersion: 6, change: update })).toEqual({
      baseVersion: 6,
      change: update,
    });
  });

  it.each([
    ["an unknown change type", { baseVersion: 6, change: { ...update, type: "shuffle" } }],
    ["a zero base version", { baseVersion: 0, change: update }],
    [
      "halves in the wrong order",
      { baseVersion: 6, change: { ...update, halves: [...update.halves].reverse() } },
    ],
    [
      "an item with an empty title",
      {
        baseVersion: 6,
        change: {
          ...update,
          halves: [{ id: "first-half", items: [{ ...item, title: " " }] }, update.halves[1]],
        },
      },
    ],
    ["no change", { baseVersion: 6 }],
  ])("rejects %s", (_case, request) => {
    expect(SaveRunningOrderRequest.safeParse(request).success).toBe(false);
  });

  it("accepts a new item with no id beside the existing ones", () => {
    const { id: _id, ...added } = { ...item, title: "Encore" };
    const withNew = {
      ...update,
      halves: [update.halves[0], { id: "second-half", items: [added] }],
    };

    expect(SaveRunningOrderRequest.safeParse({ baseVersion: 6, change: withNew }).success).toBe(
      true,
    );
  });

  it.each([
    ["a new item with no title", { title: " " }],
    ["an item whose id is empty", { id: "" }],
  ])("rejects %s", (_case, change) => {
    const { id: _id, ...added } = item;
    const bad = { ...added, ...change };
    const withBad = { ...update, halves: [update.halves[0], { id: "second-half", items: [bad] }] };

    expect(SaveRunningOrderRequest.safeParse({ baseVersion: 6, change: withBad }).success).toBe(
      false,
    );
  });
});
