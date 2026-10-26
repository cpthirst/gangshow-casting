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
      { id: 1, itemId: "pirate-sketch", name: "Treasure chest", roleIds: [] },
      { id: 2, itemId: "finale", name: "Confetti", roleIds: [] },
    ];
    const store = await make([{ productionId: "2027", props }]);

    // In no particular order (DynamoDB returns them in key order): pages count them by item.
    const listed = (await store.list("2027")).props;
    expect([...listed].sort((a, b) => a.id - b.id)).toEqual(props);
  });

  it("keeps each production's props apart", async () => {
    const store = await make([
      { productionId: "2027", props: [{ id: 1, itemId: "finale", name: "Confetti", roleIds: [] }] },
    ]);

    expect((await store.list("2028")).props).toEqual([]);
  });

  it("adds a prop to an item, giving it an id, and lists it after", async () => {
    const store = await make([]);

    const added = await store.add("2027", "pirate-sketch", { name: "Treasure chest", roleIds: [] });

    expect(added).toEqual({ id: 1, itemId: "pirate-sketch", name: "Treasure chest", roleIds: [] });
    expect((await store.list("2027")).props).toEqual([added]);
  });

  it("keeps the roles a prop is linked to", async () => {
    const store = await make([]);

    const added = await store.add("2027", "pirate-sketch", { name: "Telescope", roleIds: [3, 1] });

    expect(added.roleIds).toEqual([3, 1]);
    expect((await store.list("2027")).props[0]?.roleIds).toEqual([3, 1]);
  });

  it("gives each new prop an id no other prop in the production has", async () => {
    const store = await make([
      { productionId: "2027", props: [{ id: 4, itemId: "finale", name: "Confetti", roleIds: [] }] },
    ]);

    const first = await store.add("2027", "pirate-sketch", { name: "Treasure chest", roleIds: [] });
    const second = await store.add("2027", "pirate-sketch", { name: "Parrot", roleIds: [] });

    expect(new Set([4, first.id, second.id]).size).toBe(3);
    expect((await store.list("2027")).props).toHaveLength(3);
  });

  it("adds a prop to its own production only", async () => {
    const store = await make([]);

    await store.add("2027", "finale", { name: "Confetti", roleIds: [] });

    expect((await store.list("2028")).props).toEqual([]);
  });

  it("replaces a prop's name and roles, keeping its id and item", async () => {
    const store = await make([
      {
        productionId: "2027",
        props: [
          { id: 1, itemId: "pirate-sketch", name: "Telescope", roleIds: [1] },
          { id: 2, itemId: "pirate-sketch", name: "Parrot", roleIds: [] },
        ],
      },
    ]);

    const updated = await store.update("2027", 1, { name: "Spyglass", roleIds: [2] });

    const expected = { id: 1, itemId: "pirate-sketch", name: "Spyglass", roleIds: [2] };
    expect(updated).toEqual(expected);
    const listed = (await store.list("2027")).props;
    expect([...listed].sort((a, b) => a.id - b.id)).toEqual([
      expected,
      { id: 2, itemId: "pirate-sketch", name: "Parrot", roleIds: [] },
    ]);
  });

  it("refuses to update a prop that isn't there, adding nothing", async () => {
    const store = await make([]);

    expect(await store.update("2027", 1, { name: "Spyglass", roleIds: [] })).toBe("not-found");
    expect((await store.list("2027")).props).toEqual([]);
  });

  it("removes a prop, leaving the others", async () => {
    const parrot = { id: 2, itemId: "pirate-sketch", name: "Parrot", roleIds: [] };
    const store = await make([
      {
        productionId: "2027",
        props: [{ id: 1, itemId: "pirate-sketch", name: "Telescope", roleIds: [] }, parrot],
      },
    ]);

    expect(await store.remove("2027", 1)).toBe("removed");
    expect((await store.list("2027")).props).toEqual([parrot]);
  });

  it("refuses to remove a prop that isn't there", async () => {
    const store = await make([]);

    expect(await store.remove("2027", 1)).toBe("not-found");
  });

  it("never reuses a removed prop's id", async () => {
    const store = await make([]);
    const first = await store.add("2027", "finale", { name: "Confetti", roleIds: [] });

    await store.remove("2027", first.id);
    const second = await store.add("2027", "finale", { name: "Streamers", roleIds: [] });

    expect(second.id).not.toBe(first.id);
  });
}
