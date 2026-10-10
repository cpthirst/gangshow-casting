import type { RunningOrder, RunningOrderItem } from "@app/shared";
import { describe, expect, it } from "vitest";
import { dropItem, formatTime } from "./running-order.ts";

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
