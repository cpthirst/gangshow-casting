import type { PropList } from "@app/shared";
import { expect, it } from "vitest";
import type { PropStore } from "./prop-store.ts";

/** The rules every prop store keeps, run against each implementation. `make` gives a store
 *  already holding the props given. */
export function behavesAsAPropStore(make: (saved: PropList[]) => Promise<PropStore>) {
  it("has no props for a production nobody has added any to", async () => {
    expect(await (await make([])).list("2027")).toEqual({ productionId: "2027", props: [] });
  });

  it("lists every item's props", async () => {
    const props = [
      { id: 1, itemId: "pirate-sketch", name: "Treasure chest" },
      { id: 2, itemId: "finale", name: "Confetti" },
    ];
    const store = await make([{ productionId: "2027", props }]);

    // In no particular order (DynamoDB returns them in key order): pages count them by item.
    const listed = (await store.list("2027")).props;
    expect([...listed].sort((a, b) => a.id - b.id)).toEqual(props);
  });

  it("keeps each production's props apart", async () => {
    const store = await make([
      { productionId: "2027", props: [{ id: 1, itemId: "finale", name: "Confetti" }] },
    ]);

    expect((await store.list("2028")).props).toEqual([]);
  });

  it("adds a prop to an item, giving it an id, and lists it after", async () => {
    const store = await make([]);

    const added = await store.add("2027", "pirate-sketch", { name: "Treasure chest" });

    expect(added).toEqual({ id: 1, itemId: "pirate-sketch", name: "Treasure chest" });
    expect((await store.list("2027")).props).toEqual([added]);
  });

  it("gives each new prop an id no other prop in the production has", async () => {
    const store = await make([
      { productionId: "2027", props: [{ id: 4, itemId: "finale", name: "Confetti" }] },
    ]);

    const first = await store.add("2027", "pirate-sketch", { name: "Treasure chest" });
    const second = await store.add("2027", "pirate-sketch", { name: "Parrot" });

    expect(new Set([4, first.id, second.id]).size).toBe(3);
    expect((await store.list("2027")).props).toHaveLength(3);
  });

  it("adds a prop to its own production only", async () => {
    const store = await make([]);

    await store.add("2027", "finale", { name: "Confetti" });

    expect((await store.list("2028")).props).toEqual([]);
  });
}
