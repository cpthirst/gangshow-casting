import type { Costume, CostumeList } from "@app/shared";
import { expect, it } from "vitest";
import type { CostumeStore } from "./costume-store.ts";

/** What a cast member wears in a role in an item, all three fields filled in (made-up). */
export const aCostume = (
  itemId: string,
  roleId: number,
  castMemberId: number,
  details: Partial<Costume> = {},
): Costume => ({
  itemId,
  roleId,
  castMemberId,
  fromWardrobe: "Red coat, hook",
  fromCastMember: "Black shoes",
  notes: "Hem the coat",
  ...details,
});

// Made-up: Alex Morgan (1) is Captain Hook (7) and Jo Brown (2) a Pirate (8) in Opening
// Number; Alex is also a Sailor (9) in the Finale.
const alexAsHook = aCostume("opening-number", 7, 1);
const joAsPirate = aCostume("opening-number", 8, 2, { fromWardrobe: "Striped top" });
const alexAsSailor = aCostume("finale", 9, 1, { fromWardrobe: "Sailor suit" });

const byRow = (list: CostumeList) =>
  [...list.costumes].sort((a, b) => a.roleId - b.roleId || a.castMemberId - b.castMemberId);

/** The rules every costume store keeps, run against each implementation. `make` gives a store
 *  already holding the costumes given. */
export function behavesAsACostumeStore(make: (saved: CostumeList[]) => Promise<CostumeStore>) {
  it("has no costumes in a production nobody has filled any in", async () => {
    expect(await (await make([])).list("2027")).toEqual({ productionId: "2027", costumes: [] });
  });

  it("saves a row's three fields together, answering with the costume", async () => {
    const store = await make([]);

    expect(await store.save("2027", alexAsHook)).toEqual(alexAsHook);
    expect((await store.list("2027")).costumes).toEqual([alexAsHook]);
  });

  it("replaces a row's fields when it's saved again, leaving the other rows", async () => {
    const store = await make([{ productionId: "2027", costumes: [alexAsHook, joAsPirate] }]);
    const changed = { ...alexAsHook, fromWardrobe: "Blue coat", notes: "" };

    await store.save("2027", changed);

    expect(byRow(await store.list("2027"))).toEqual([changed, joAsPirate]);
  });

  it("keeps a cast member's row in each of their roles apart", async () => {
    const store = await make([]);

    await store.save("2027", alexAsHook);
    await store.save("2027", alexAsSailor);

    expect(byRow(await store.list("2027"))).toEqual([alexAsHook, alexAsSailor]);
  });

  it("keeps nothing for a row once all three fields are emptied", async () => {
    const store = await make([{ productionId: "2027", costumes: [alexAsHook, joAsPirate] }]);
    const emptied = { ...alexAsHook, fromWardrobe: "", fromCastMember: "", notes: "" };

    expect(await store.save("2027", emptied)).toEqual(emptied);
    expect((await store.list("2027")).costumes).toEqual([joAsPirate]);
  });

  it("keeps each production's costumes apart", async () => {
    const store = await make([]);

    await store.save("2027", alexAsHook);

    expect((await store.list("2028")).costumes).toEqual([]);
  });

  it("deletes the costumes of every item not kept, in that production only", async () => {
    const store = await make([
      { productionId: "2027", costumes: [alexAsHook, joAsPirate, alexAsSailor] },
      { productionId: "2028", costumes: [alexAsHook] },
    ]);

    await store.keepOnlyItems("2027", ["finale", "curtain-up"]);

    expect((await store.list("2027")).costumes).toEqual([alexAsSailor]);
    expect((await store.list("2028")).costumes).toEqual([alexAsHook]);
  });
}
