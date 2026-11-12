import { CostumeList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { aRole } from "#/casting/roles/role-store.contract.ts";
import { inMemoryRoleStore } from "#/casting/roles/role-store.ts";
import { lambdaEntry } from "#/http/lambda-entry.ts";
import { request } from "#/http/request.fixture.ts";
import { aCostume } from "#/production/costumes/costume-store.contract.ts";
import { inMemoryProductionListStore } from "#/production-list/production-list-store.ts";
import { createRoutes } from "#/routes.ts";
import { aRunningOrder, itemId } from "#/show/running-order/running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "#/show/running-order/running-order-store.ts";
import { inMemoryStores, noItemFiles } from "#/storage/stores.fixture.ts";
import { inMemoryUsageStore } from "#/usage/usage-store.ts";

// The costume routes as hosted, behind the entry point's permission check (routeNeeds).

const opening = itemId("Opening Number");
// Made-up: Alex Morgan (1) is Captain Hook (1) in Opening Number.
// The body of a save: the item comes from the path.
const { itemId: _, ...alexAsHook } = aCostume(opening, 1, 1);

const setUp = () =>
  lambdaEntry(
    createRoutes(
      inMemoryStores({
        roles: inMemoryRoleStore([
          {
            productionId: "2027",
            roles: [aRole(1, { itemId: opening, name: "Captain Hook", castMemberIds: [1] })],
          },
        ]),
        runningOrders: inMemoryRunningOrderStore([aRunningOrder(4, { first: ["Opening Number"] })]),
      }),
      inMemoryUsageStore(),
      noItemFiles,
    ),
    inMemoryProductionListStore(),
  );
type Api = ReturnType<typeof setUp>;

const save = (groups: string) =>
  request(
    "PUT",
    `/api/productions/2027/items/${opening}/costumes`,
    { body: JSON.stringify(alexAsHook) },
    groups,
  );
const costumesIn = async (api: Api) =>
  CostumeList.parse(
    JSON.parse((await api(request("GET", "/api/productions/2027/costumes", {}, "[]"))).body ?? ""),
  ).costumes;

describe("the costume routes", () => {
  it.each([
    ["kit, with Wardrobe", "[wardrobe]"],
    ["dee, with Director", "[director]"],
    ["ann, an admin", "[admin]"],
  ])("save a costume from %s, which anyone signed in then reads", async (_who, groups) => {
    const api = setUp();

    expect((await api(save(groups))).statusCode).toBe(200);
    expect(await costumesIn(api)).toEqual([{ itemId: opening, ...alexAsHook }]);
  });

  it("refuse lee's save, with Tech only, saying the wardrobe is view-only and saving nothing", async () => {
    const api = setUp();

    const res = await api(save("[tech]"));

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body ?? "")).toEqual({
      message: "You can view the wardrobe, but not change it.",
      department: "wardrobe",
    });
    expect(await costumesIn(api)).toEqual([]);
  });
});
