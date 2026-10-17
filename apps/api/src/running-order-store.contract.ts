import type { RunningOrder } from "@app/shared";
import { expect, it } from "vitest";
import { aRunningOrder } from "./running-order.fixture.ts";
import type { RunningOrderStore } from "./running-order-store.ts";

/** The rules every running order store keeps, run against each implementation. `make`
 *  starts it holding the given versions. */
export function behavesAsARunningOrderStore(
  make: (initial?: RunningOrder[]) => Promise<RunningOrderStore>,
) {
  it("returns the highest version by number", async () => {
    const store = await make([aRunningOrder(9), aRunningOrder(10)]);

    expect((await store.latest("2027"))?.version).toBe(10);
  });

  it("returns nothing for a production with no versions", async () => {
    expect(await (await make()).latest("2027")).toBeUndefined();
  });

  it("saves the first version of a new production", async () => {
    const store = await make();

    expect(await store.save(aRunningOrder(1))).toBe("saved");
    expect(await store.latest("2027")).toEqual(aRunningOrder(1));
  });

  it("saves a new version that becomes the latest, keeping every earlier one exactly", async () => {
    const store = await make([aRunningOrder(5), aRunningOrder(6)]);

    expect(await store.save(aRunningOrder(7, { first: ["Big Finish"] }))).toBe("saved");

    expect(await store.latest("2027")).toEqual(aRunningOrder(7, { first: ["Big Finish"] }));
    expect(await store.get("2027", 5)).toEqual(aRunningOrder(5));
    expect(await store.get("2027", 6)).toEqual(aRunningOrder(6));
  });

  it("refuses to save over an existing version", async () => {
    const store = await make([aRunningOrder(7)]);

    expect(await store.save(aRunningOrder(7, { first: ["Big Finish"] }))).toBe("conflict");
    expect(await store.get("2027", 7)).toEqual(aRunningOrder(7));
  });

  it("lets only one of two simultaneous saves of the same version through", async () => {
    const store = await make([aRunningOrder(5)]);

    const results = await Promise.all([
      store.save(aRunningOrder(6, { first: ["Mine"] })),
      store.save(aRunningOrder(6, { first: ["Theirs"] })),
    ]);

    expect([...results].sort()).toEqual(["conflict", "saved"]);
  });

  it("returns nothing for a version that was never saved", async () => {
    expect(await (await make([aRunningOrder(1)])).get("2027", 3)).toBeUndefined();
  });

  it("keeps each production's versions apart", async () => {
    const store = await make([aRunningOrder(4)]);

    expect(await store.latest("2028")).toBeUndefined();
  });
}
