import { expect, it } from "vitest";
import type { ProductionListStore } from "./production-list-store.ts";

type Make = (productions?: string[]) => Promise<ProductionListStore>;

/** The rules every store of the list of productions keeps, run against each implementation. */
export function behavesAsAProductionListStore(make: Make) {
  it("lists 2027, the production already held, when the list is empty", async () => {
    const store = await make();

    expect(await store.list()).toEqual({ productions: ["2027"] });
  });

  it("keeps 2027 once it has written it", async () => {
    const store = await make();
    await store.list();

    expect(await store.list()).toEqual({ productions: ["2027"] });
  });

  it("lists every production it holds", async () => {
    const store = await make(["2027", "2028"]);

    expect((await store.list()).productions.toSorted()).toEqual(["2027", "2028"]);
  });

  it("doesn't bring 2027 back once the list holds others without it", async () => {
    const store = await make(["2028"]);

    expect(await store.list()).toEqual({ productions: ["2028"] });
  });

  it("holds a production once it has started it, as well as the others", async () => {
    const store = await make(["2027"]);

    expect(await store.start("2028")).toBe("started");

    expect((await store.list()).productions.toSorted()).toEqual(["2027", "2028"]);
  });

  it("won't start a production it already holds", async () => {
    const store = await make(["2027", "2028"]);

    expect(await store.start("2028")).toBe("exists");

    expect((await store.list()).productions.toSorted()).toEqual(["2027", "2028"]);
  });
}
