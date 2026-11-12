import { Costume } from "@app/shared";
import { describe, expect, it } from "vitest";
import { aRole } from "#/casting/roles/role-store.contract.ts";
import { inMemoryRoleStore } from "#/casting/roles/role-store.ts";
import { aRunningOrder, itemId } from "#/show/running-order/running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { aCostume } from "./costume-store.contract.ts";
import { inMemoryCostumeStore } from "./costume-store.ts";
import { createSaveCostume } from "./save-costume.ts";

const opening = itemId("Opening Number");
const finale = itemId("Finale");
// Made-up: Alex Morgan (1) is Captain Hook (7) in Opening Number; Jo Brown (2) is in the
// Finale's Sailors (8) only.
const [alex, jo] = [1, 2];
const [hook, sailors] = [7, 8];

// The body of a save: the item comes from the path.
const { itemId: _, ...alexAsHook } = aCostume(opening, hook, alex);

const request = (body: unknown, item = opening) => ({
  pathParameters: { productionId: "2027", itemId: item },
  body: JSON.stringify(body),
});

function setUp() {
  const costumes = inMemoryCostumeStore();
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
  const saved = async () => (await costumes.list("2027")).costumes;
  return { saved, handler: createSaveCostume(costumes, runningOrders, roles) };
}

describe("save costume handler", () => {
  it("saves a row's three fields together, trimmed, answering with the costume", async () => {
    const { saved, handler } = setUp();

    const res = await handler(request({ ...alexAsHook, notes: "  Hem the coat " }));

    expect(res.statusCode).toBe(200);
    const costume = { itemId: opening, ...alexAsHook };
    expect(Costume.parse(JSON.parse(res.body ?? ""))).toEqual(costume);
    expect(await saved()).toEqual([costume]);
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
