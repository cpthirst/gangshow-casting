import { describe, expect, it } from "vitest";
import { ProductionId, RunningOrder } from "./running-order.ts";

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
