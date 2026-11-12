import type { CastList, Costume, CostumeList, RoleList } from "@app/shared";
import { expect, it } from "vitest";
import { aRole } from "#/casting/roles/role-store.contract.ts";
import { aCastList, aCastMember } from "#/show/cast/cast.fixture.ts";
import type { CostumeStore } from "./costume-store.ts";

/** What a cast member wears in a role in an item, all three fields filled in, as first saved
 *  (made-up). */
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
  revision: 1,
  ...details,
});

// Made-up: Alex Morgan (1) is Captain Hook (7) and Jo Brown (2) a Pirate (8) in Opening
// Number; Alex is also a Sailor (9) in the Finale.
const alexAsHook = aCostume("opening-number", 7, 1);
const joAsPirate = aCostume("opening-number", 8, 2, { fromWardrobe: "Striped top" });
const alexAsSailor = aCostume("finale", 9, 1, { fromWardrobe: "Sailor suit" });

/** The casting those costumes follow, which a store that checks it holds too. */
export const costumeCasting: { roles: RoleList; cast: CastList } = {
  roles: {
    productionId: "2027",
    roles: [
      aRole(7, { itemId: "opening-number", name: "Captain Hook", castMemberIds: [1] }),
      aRole(8, { itemId: "opening-number", name: "Pirates", castMemberIds: [2] }),
      aRole(9, { itemId: "finale", name: "Sailors", castMemberIds: [1] }),
    ],
  },
  cast: aCastList([aCastMember(1), aCastMember(2)]),
};

/** The role a costume is in, as the caller read it. */
function roleOf({ roleId }: Pick<Costume, "roleId">) {
  const role = costumeCasting.roles.roles.find(({ id }) => id === roleId);
  if (!role) throw new Error(`no role ${roleId}`);
  return role;
}

const byRow = (list: CostumeList) =>
  [...list.costumes].sort((a, b) => a.roleId - b.roleId || a.castMemberId - b.castMemberId);

/** The rules every costume store keeps, run against each implementation. `make` gives a store
 *  already holding the costumes given. */
export function behavesAsACostumeStore(make: (saved: CostumeList[]) => Promise<CostumeStore>) {
  it("has no costumes in a production nobody has filled any in", async () => {
    expect(await (await make([])).list("2027")).toEqual({ productionId: "2027", costumes: [] });
  });

  it("saves a row nobody has saved at revision 0, answering with it at revision 1", async () => {
    const store = await make([]);

    expect(await store.save("2027", alexAsHook, 0, roleOf(alexAsHook))).toEqual(alexAsHook);
    expect((await store.list("2027")).costumes).toEqual([alexAsHook]);
  });

  it("replaces a row's fields at its next revision, leaving the other rows", async () => {
    const store = await make([{ productionId: "2027", costumes: [alexAsHook, joAsPirate] }]);
    const changed = { ...alexAsHook, fromWardrobe: "Blue coat", notes: "" };

    expect(await store.save("2027", changed, 1, roleOf(changed))).toEqual({
      ...changed,
      revision: 2,
    });

    expect(byRow(await store.list("2027"))).toEqual([{ ...changed, revision: 2 }, joAsPirate]);
  });

  it.each([
    ["a revision it has moved on from", 0],
    ["a revision it hasn't reached", 2],
  ])("refuses a save from %s, changing nothing", async (_case, revision) => {
    const store = await make([{ productionId: "2027", costumes: [alexAsHook] }]);
    const blueCoat = { ...alexAsHook, fromWardrobe: "Blue coat" };

    expect(await store.save("2027", blueCoat, revision, roleOf(blueCoat))).toBe("stale");
    expect((await store.list("2027")).costumes).toEqual([alexAsHook]);
  });

  it("refuses a save from a revision a row nobody has saved hasn't reached", async () => {
    const store = await make([]);

    expect(await store.save("2027", alexAsHook, 1, roleOf(alexAsHook))).toBe("stale");
    expect((await store.list("2027")).costumes).toEqual([]);
  });

  it("keeps a cast member's row in each of their roles apart", async () => {
    const store = await make([]);

    await store.save("2027", alexAsHook, 0, roleOf(alexAsHook));
    await store.save("2027", alexAsSailor, 0, roleOf(alexAsSailor));

    expect(byRow(await store.list("2027"))).toEqual([alexAsHook, alexAsSailor]);
  });

  it("keeps a row emptied of all three fields, so a stale save is still refused", async () => {
    const store = await make([{ productionId: "2027", costumes: [alexAsHook] }]);
    const emptied = { ...alexAsHook, fromWardrobe: "", fromCastMember: "", notes: "", revision: 2 };

    expect(await store.save("2027", emptied, 1, roleOf(emptied))).toEqual(emptied);
    expect(await store.save("2027", alexAsHook, 1, roleOf(alexAsHook))).toBe("stale");
    expect(await store.save("2027", alexAsHook, 0, roleOf(alexAsHook))).toBe("stale");
    expect((await store.list("2027")).costumes).toEqual([emptied]);
  });

  it("keeps each production's costumes apart", async () => {
    const store = await make([]);

    await store.save("2027", alexAsHook, 0, roleOf(alexAsHook));

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

  it("deletes the costumes of every role not kept, in that production only", async () => {
    const store = await make([
      { productionId: "2027", costumes: [alexAsHook, joAsPirate, alexAsSailor] },
      { productionId: "2028", costumes: [joAsPirate] },
    ]);

    await store.keepOnlyRoles("2027", [7, 9]);

    expect(byRow(await store.list("2027"))).toEqual([alexAsHook, alexAsSailor]);
    expect((await store.list("2028")).costumes).toEqual([joAsPirate]);
  });

  it("deletes a cast member's costumes in every item, in that production only", async () => {
    const store = await make([
      { productionId: "2027", costumes: [alexAsHook, joAsPirate, alexAsSailor] },
      { productionId: "2028", costumes: [alexAsHook] },
    ]);

    await store.deleteCostumesOf("2027", 1);

    expect((await store.list("2027")).costumes).toEqual([joAsPirate]);
    expect((await store.list("2028")).costumes).toEqual([alexAsHook]);
  });
}
