import type { RunningOrderItem, UpdateChange } from "@app/shared";
import { describe, expect, it } from "vitest";
import { anItem, aRunningOrder } from "./running-order.fixture.ts";
import { applyChange } from "./running-order-changes.ts";

const update = (first: RunningOrderItem[], second: RunningOrderItem[]): UpdateChange => ({
  type: "update",
  halves: [
    { id: "first-half", items: first },
    { id: "second-half", items: second },
  ],
});

const titles = (order: ReturnType<typeof aRunningOrder>) =>
  order.halves.map((half) => half.items.map((item) => item.title));

describe("applyChange: update", () => {
  const latest = aRunningOrder(6, { first: ["A", "B"], second: ["C"] });
  const [a, b, c] = [anItem("A"), anItem("B"), anItem("C")];

  it("puts every item in its new place", () => {
    const result = applyChange(latest, update([b], [c, a]));

    if (!result.ok) throw new Error(result.error);
    expect(titles(result.order)).toEqual([["B"], ["C", "A"]]);
  });

  it("takes each item's edited details", () => {
    const result = applyChange(latest, update([{ ...a, minutes: 20, printed: false }, b], [c]));

    if (!result.ok) throw new Error(result.error);
    expect(result.order.halves[0].items[0]).toEqual({ ...a, minutes: 20, printed: false });
  });

  it.each([
    ["loses an item", update([a, b], [])],
    ["duplicates an item", update([a, a, b], [c])],
    ["invents an item", update([a, b], [c, anItem("D")])],
  ])("rejects an update that %s", (_case, change) => {
    expect(applyChange(latest, change).ok).toBe(false);
  });
});
