import type { ReorderChange } from "@app/shared";
import { describe, expect, it } from "vitest";
import { aRunningOrder, itemId } from "./running-order.fixture.ts";
import { applyChange } from "./running-order-changes.ts";

const reorder = (first: string[], second: string[]): ReorderChange => ({
  type: "reorder",
  halves: [
    { id: "first-half", itemIds: first.map(itemId) },
    { id: "second-half", itemIds: second.map(itemId) },
  ],
});

const titles = (order: ReturnType<typeof aRunningOrder>) =>
  order.halves.map((half) => half.items.map((item) => item.title));

describe("applyChange: reorder", () => {
  const latest = aRunningOrder(6, { first: ["A", "B"], second: ["C"] });

  it("puts every item in its new place, keeping its details", () => {
    const result = applyChange(latest, reorder(["B"], ["C", "A"]));

    if (!result.ok) throw new Error(result.error);
    expect(titles(result.order)).toEqual([["B"], ["C", "A"]]);
    expect(result.order.halves[1].items[1]).toEqual(latest.halves[0].items[0]);
  });

  it.each([
    ["loses an item", reorder(["A", "B"], [])],
    ["duplicates an item", reorder(["A", "A", "B"], ["C"])],
    ["invents an item", reorder(["A", "B"], ["C", "D"])],
  ])("rejects a reorder that %s", (_case, change) => {
    expect(applyChange(latest, change).ok).toBe(false);
  });
});
