import type { ChangeItem, UpdateChange } from "@app/shared";
import { describe, expect, it } from "vitest";
import { anItem, aRunningOrder } from "./running-order.fixture.ts";
import { applyChange } from "./running-order-changes.ts";

const update = (first: ChangeItem[], second: ChangeItem[]): UpdateChange => ({
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

  it("drops an item the update leaves out", () => {
    const result = applyChange(latest, update([a], [c]));

    if (!result.ok) throw new Error(result.error);
    expect(titles(result.order)).toEqual([["A"], ["C"]]);
  });

  it("gives an added item a new id and keeps it where it was put", () => {
    const { id: _id, ...encore } = anItem("Encore");
    const result = applyChange(latest, update([a, b], [c, encore]), () => "new-id-1");

    if (!result.ok) throw new Error(result.error);
    expect(titles(result.order)).toEqual([
      ["A", "B"],
      ["C", "Encore"],
    ]);
    expect(result.order.halves[1].items[1]?.id).toBe("new-id-1");
  });

  it("gives each added item its own id", () => {
    const { id: _id, ...encore } = anItem("Encore");
    const { id: _other, ...walkDown } = anItem("Walk Down");
    const ids = ["new-id-1", "new-id-2"];
    const result = applyChange(
      latest,
      update([a, b, encore], [c, walkDown]),
      () => ids.shift() ?? "",
    );

    if (!result.ok) throw new Error(result.error);
    const added = result.order.halves.flatMap((half) => half.items.slice(-1).map((i) => i.id));
    expect(added).toEqual(["new-id-1", "new-id-2"]);
  });

  it.each([
    ["duplicates an item", update([a, a, b], [c])],
    ["invents an item", update([a, b], [c, anItem("D")])],
  ])("rejects an update that %s", (_case, change) => {
    expect(applyChange(latest, change).ok).toBe(false);
  });
});
