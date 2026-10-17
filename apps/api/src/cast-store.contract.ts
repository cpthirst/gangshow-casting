import type { CastList, CastMemberDetails } from "@app/shared";
import { expect, it } from "vitest";
import { aCastList, aCastMember } from "./cast.fixture.ts";
import type { CastStore } from "./cast-store.ts";

const jo: CastMemberDetails = { firstName: "Jo", lastName: "Newcomer", section: null, group: "" };

/** The rules every cast store keeps, run against each implementation. `make` starts it
 *  holding the given cast lists. */
export function behavesAsACastStore(make: (initial?: CastList[]) => Promise<CastStore>) {
  it("returns a production's cast list", async () => {
    const list = aCastList([aCastMember(1), aCastMember(2, { firstName: "Alex" })]);

    expect(await (await make([list])).list("2027")).toEqual(list);
  });

  it("returns nothing for a production with no cast list", async () => {
    expect(await (await make()).list("2027")).toBeUndefined();
  });

  it("loads members saved before Singing and Acting notes existed", async () => {
    const store = await make([aCastList([aCastMember(1)])]);

    const member = (await store.list("2027"))?.members[0];
    expect([member?.singing, member?.acting]).toEqual([undefined, undefined]);
  });

  it("adds a member with the next id and revision 1", async () => {
    const store = await make([aCastList([aCastMember(1), aCastMember(56)])]);

    const added = await store.add("2027", { ...jo, singing: "Alto" });

    expect(added).toEqual({ ...jo, singing: "Alto", id: 57, revision: 1 });
    expect((await store.list("2027"))?.members.map((m) => m.id)).toEqual([1, 56, 57]);
  });

  it("adds nothing to a production with no cast list", async () => {
    expect(await (await make()).add("2027", { ...jo })).toBeUndefined();
  });

  it("never gives a deleted member's id to someone new", async () => {
    const store = await make([aCastList([aCastMember(1), aCastMember(57)])]);

    await store.remove("2027", 57, 1);
    expect((await store.add("2027", { ...jo }))?.id).toBe(58);
  });

  it("gives simultaneous adds different ids and keeps both", async () => {
    const store = await make([aCastList([aCastMember(1)])]);

    const [a, b] = await Promise.all([store.add("2027", { ...jo }), store.add("2027", { ...jo })]);

    expect(new Set([a?.id, b?.id]).size).toBe(2);
    expect((await store.list("2027"))?.members).toHaveLength(3);
  });

  it("updates a member at the given revision, bumping the revision", async () => {
    const store = await make([aCastList([aCastMember(12, { revision: 3 }), aCastMember(13)])]);

    expect(await store.update("2027", 12, 3, { ...jo })).toEqual({ ...jo, id: 12, revision: 4 });
    const members = (await store.list("2027"))?.members;
    expect(members?.find((m) => m.id === 12)).toEqual({ ...jo, id: 12, revision: 4 });
    expect(members).toHaveLength(2);
  });

  it("refuses a stale update, an unknown member and a production with no list", async () => {
    const store = await make([aCastList([aCastMember(12, { revision: 4 })])]);

    expect(await store.update("2027", 12, 3, { ...jo })).toBe("stale");
    expect(await store.update("2027", 99, 1, { ...jo })).toBe("not-found");
    expect(await store.update("1999", 12, 4, { ...jo })).toBe("not-found");
    expect((await store.list("2027"))?.members).toEqual([aCastMember(12, { revision: 4 })]);
  });

  it("removes a member at the given revision", async () => {
    const store = await make([aCastList([aCastMember(1), aCastMember(2, { revision: 4 })])]);

    expect(await store.remove("2027", 2, 4)).toBe("removed");
    expect((await store.list("2027"))?.members.map((m) => m.id)).toEqual([1]);
  });

  it("refuses a stale remove, an unknown member and a production with no list", async () => {
    const store = await make([aCastList([aCastMember(2, { revision: 4 })])]);

    expect(await store.remove("2027", 2, 3)).toBe("stale");
    expect(await store.remove("2027", 9, 1)).toBe("not-found");
    expect(await store.remove("1999", 2, 4)).toBe("not-found");
    expect((await store.list("2027"))?.members).toHaveLength(1);
  });

  it("keeps a production whose last member was removed, with an empty list", async () => {
    const store = await make([aCastList([aCastMember(1)])]);

    await store.remove("2027", 1, 1);

    expect(await store.list("2027")).toEqual(aCastList([]));
  });
}
