import { Costume } from "@app/shared";
import { describe, expect, it } from "vitest";
import { aRole } from "#/casting/roles/role-store.contract.ts";
import { inMemoryRoleStore, type RoleStore } from "#/casting/roles/role-store.ts";
import { aRunningOrder, itemId } from "#/show/running-order/running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { aCostume } from "./costume-store.contract.ts";
import { type CostumeStore, inMemoryCostumeStore } from "./costume-store.ts";
import { createSaveCostume } from "./save-costume.ts";

const opening = itemId("Opening Number");
const finale = itemId("Finale");
// Made-up: Alex Morgan (1) is Captain Hook (7) in Opening Number; Jo Brown (2) is in the
// Finale's Sailors (8) only.
const [alex, jo] = [1, 2];
const [hook, sailors] = [7, 8];

// The body of a save of a row nobody has saved: the item comes from the path.
const { itemId: _, ...alexAsHook } = aCostume(opening, hook, alex, { revision: 0 });

const request = (body: unknown, item = opening) => ({
  pathParameters: { productionId: "2027", itemId: item },
  body: JSON.stringify(body),
});

/** Before each save, with its attempt from 1: whether the remote store would refuse it as
 *  stale because the role moved on since the handler read it. */
type Racing = (roles: RoleStore, attempt: number) => Promise<boolean>;

function setUp(existing: Costume[] = [], racing?: Racing) {
  const stored = inMemoryCostumeStore([{ productionId: "2027", costumes: existing }]);
  const runningOrders = inMemoryRunningOrderStore([
    aRunningOrder(3, { first: ["Opening Number"], second: ["Finale"] }),
  ]);
  const roles = inMemoryRoleStore([
    {
      productionId: "2027",
      roles: [
        aRole(hook, { itemId: opening, name: "Captain Hook", castMemberIds: [alex] }),
        aRole(sailors, { itemId: finale, size: "ensemble", castMemberIds: [jo] }),
      ],
    },
  ]);
  let attempts = 0;
  const costumes: CostumeStore = {
    ...stored,
    save: async (...args) => ((await racing?.(roles, ++attempts)) ? "stale" : stored.save(...args)),
  };
  const saved = async () => (await stored.list("2027")).costumes;
  return {
    saved,
    attempts: () => attempts,
    handler: createSaveCostume(costumes, runningOrders, roles),
  };
}

describe("save costume handler", () => {
  it("saves a row's three fields together, trimmed, answering with the costume", async () => {
    const { saved, handler } = setUp();

    const res = await handler(request({ ...alexAsHook, notes: "  Hem the coat " }));

    expect(res.statusCode).toBe(200);
    const costume = aCostume(opening, hook, alex);
    expect(Costume.parse(JSON.parse(res.body ?? ""))).toEqual(costume);
    expect(await saved()).toEqual([costume]);
  });

  it("refuses a save someone else saved first with 409, answering with the row as it is now", async () => {
    // Made-up: dee saved From Wardrobe "Blue coat" since kit opened the row at revision 1.
    const blueCoat = aCostume(opening, hook, alex, { fromWardrobe: "Blue coat", revision: 2 });
    const { saved, handler } = setUp([blueCoat]);

    const res = await handler(
      request({ ...alexAsHook, fromWardrobe: "Red coat, hook", revision: 1 }),
    );

    expect(res.statusCode).toBe(409);
    expect(Costume.parse(JSON.parse(res.body ?? ""))).toEqual(blueCoat);
    expect(await saved()).toEqual([blueCoat]);
  });

  it("saves with the role read again when only the role moved on, and they're still in it", async () => {
    // Someone added Jo to Captain Hook while the save was on its way.
    const { saved, handler } = setUp([], async (roles, attempt) => {
      if (attempt > 1) return false;
      await roles.update("2027", hook, 1, {
        name: "Captain Hook",
        size: "support",
        castMemberIds: [alex, jo],
      });
      return true;
    });

    const res = await handler(request(alexAsHook));

    expect(res.statusCode).toBe(200);
    expect(await saved()).toEqual([aCostume(opening, hook, alex)]);
  });

  it("refuses with 400 when the role moved on and they're no longer in it, saving nothing", async () => {
    // Someone recast Captain Hook to Jo while the save was on its way.
    const { saved, handler } = setUp([], async (roles, attempt) => {
      if (attempt === 1) {
        await roles.update("2027", hook, 1, {
          name: "Captain Hook",
          size: "support",
          castMemberIds: [jo],
        });
      }
      return true;
    });

    const res = await handler(request(alexAsHook));

    expect(res.statusCode).toBe(400);
    expect(await saved()).toEqual([]);
  });

  it("gives up with the stale answer when the role keeps moving on", async () => {
    const { saved, attempts, handler } = setUp([], async () => true);

    const res = await handler(request(alexAsHook));

    expect(res.statusCode).toBe(409);
    expect(attempts()).toBe(3);
    expect(await saved()).toEqual([]);
  });

  it("refuses a stale save of a row nobody has saved with a bare 409, saving nothing", async () => {
    const { saved, handler } = setUp();

    const res = await handler(request({ ...alexAsHook, revision: 1 }));

    expect(res.statusCode).toBe(409);
    expect(res.body).toBeUndefined();
    expect(await saved()).toEqual([]);
  });

  it.each(["fromWardrobe", "fromCastMember", "notes"])(
    "refuses %s over 500 characters with 400, saving nothing",
    async (field) => {
      const { saved, handler } = setUp();

      const res = await handler(request({ ...alexAsHook, [field]: "x".repeat(501) }));

      expect(res.statusCode).toBe(400);
      expect(await saved()).toEqual([]);
    },
  );

  it("refuses a role that isn't in the item with 400, saving nothing", async () => {
    const { saved, handler } = setUp();

    const res = await handler(request({ ...alexAsHook, roleId: sailors, castMemberId: jo }));

    expect(res.statusCode).toBe(400);
    expect(await saved()).toEqual([]);
  });

  it("refuses a cast member who isn't in the role with 400, saving nothing", async () => {
    const { saved, handler } = setUp();

    const res = await handler(request({ ...alexAsHook, castMemberId: jo }));

    expect(res.statusCode).toBe(400);
    expect(await saved()).toEqual([]);
  });

  it("answers 404 for an item not in the latest saved running order, saving nothing", async () => {
    const { saved, handler } = setUp();

    const res = await handler(request(alexAsHook, itemId("Cut Sketch")));

    expect(res.statusCode).toBe(404);
    expect(await saved()).toEqual([]);
  });

  it("answers 404 for a production id that isn't valid", async () => {
    const { handler } = setUp();

    const res = await handler({ ...request(alexAsHook), pathParameters: { productionId: "../x" } });

    expect(res.statusCode).toBe(404);
  });
});
