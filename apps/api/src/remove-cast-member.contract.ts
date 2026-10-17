import type { CastList, RoleList } from "@app/shared";
import { expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import type { CastStore } from "./cast-store.ts";
import type { RemoveCastMember } from "./remove-cast-member.ts";
import { aRole } from "./role-store.contract.ts";
import type { RoleStore } from "./role-store.ts";

export interface Removal {
  remove: RemoveCastMember;
  cast: CastStore;
  roles: RoleStore;
}

// Jo is member 12, at revision 4; Sam (1) shares an ensemble with them.
const cast = () => aCastList([aCastMember(1), aCastMember(12, { firstName: "Jo", revision: 4 })]);
const rolesFor = (count: number): RoleList => ({
  productionId: "2027",
  roles: Array.from({ length: count }, (_, i) =>
    aRole(i + 1, { itemId: `item-${i % 30}`, castMemberIds: i === 0 ? [12, 1] : [12] }),
  ),
});

/** The rules deleting a cast member keeps, run against each pair of stores. `make` starts
 *  them holding the given cast list and roles. */
export function behavesAsCastRemoval(make: (cast: CastList, roles: RoleList) => Promise<Removal>) {
  const castIds = async ({ cast }: Removal) => (await cast.list("2027"))?.members.map((m) => m.id);
  const castIn = async ({ roles }: Removal) =>
    (await roles.list("2027")).roles.flatMap((role) => role.castMemberIds);

  it("removes them from the cast and from every role, keeping the roles", async () => {
    const stores = await make(cast(), rolesFor(3));

    expect(await stores.remove("2027", 12, 4)).toBe("removed");

    expect(await castIds(stores)).toEqual([1]);
    expect(await castIn(stores)).toEqual([1]);
    expect((await stores.roles.list("2027")).roles).toHaveLength(3);
  });

  it("changes nothing when the delete is stale", async () => {
    const stores = await make(cast(), rolesFor(3));

    expect(await stores.remove("2027", 12, 3)).toBe("stale");

    expect(await castIds(stores)).toEqual([1, 12]);
    expect(await castIn(stores)).toEqual([12, 1, 12, 12]);
  });

  it("refuses an unknown member, changing nothing", async () => {
    const stores = await make(cast(), rolesFor(3));

    expect(await stores.remove("2027", 99, 1)).toBe("not-found");

    expect(await castIds(stores)).toEqual([1, 12]);
  });

  it("deletes someone in no roles, leaving the roles as they were", async () => {
    const stores = await make(cast(), {
      productionId: "2027",
      roles: [aRole(1, { castMemberIds: [1] })],
    });

    expect(await stores.remove("2027", 12, 4)).toBe("removed");

    expect(await castIds(stores)).toEqual([1]);
    expect((await stores.roles.list("2027")).roles).toEqual([aRole(1, { castMemberIds: [1] })]);
  });

  it("fully uncasts someone in more roles than one change can hold", async () => {
    const stores = await make(cast(), rolesFor(120));

    expect(await stores.remove("2027", 12, 4)).toBe("removed");

    expect(await castIds(stores)).toEqual([1]);
    expect(await castIn(stores)).toEqual([1]);
  });
}
