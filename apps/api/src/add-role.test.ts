import { AddRoleRefusal, Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createAddRole } from "./add-role.ts";
import { inMemoryRoleStore } from "./role-store.ts";
import { aRunningOrder, itemId } from "./running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "./running-order-store.ts";

const pirateSketch = itemId("Pirate Sketch");

const request = (body: unknown, item = pirateSketch, productionId = "2027") => ({
  pathParameters: { productionId, itemId: item },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

function setUp() {
  const roles = inMemoryRoleStore();
  const runningOrders = inMemoryRunningOrderStore([
    aRunningOrder(7, { first: ["Opening Number", "Pirate Sketch"] }),
  ]);
  return { roles, handler: createAddRole(roles, runningOrders) };
}

describe("add role handler", () => {
  it("returns 201 with the new uncast role, its id and revision 1", async () => {
    const { roles, handler } = setUp();

    const res = await handler(request({ name: "Captain Hook", size: "lead" }));

    expect(res.statusCode).toBe(201);
    expect(Role.parse(JSON.parse(res.body ?? ""))).toEqual({
      id: 1,
      itemId: pirateSketch,
      name: "Captain Hook",
      size: "lead",
      castMemberIds: [],
      revision: 1,
    });
    expect((await roles.list("2027")).roles).toHaveLength(1);
  });

  it.each([
    ["no name", { size: "lead" }],
    ["a name of only spaces", { name: "   ", size: "lead" }],
    ["a name over 60 characters", { name: "x".repeat(61), size: "lead" }],
    ["an unknown size", { name: "Captain Hook", size: "star" }],
    ["no size", { name: "Captain Hook" }],
    ["an extra field", { name: "Captain Hook", size: "lead", castNames: ["Sam Example"] }],
    ["malformed JSON", "{not json"],
  ])("rejects %s with 400, storing nothing", async (_case, body) => {
    const { roles, handler } = setUp();

    expect((await handler(request(body))).statusCode).toBe(400);
    expect((await roles.list("2027")).roles).toEqual([]);
  });

  it("returns 404 for an item that isn't in the latest saved running order", async () => {
    const { roles, handler } = setUp();

    const res = await handler(request({ name: "Captain Hook", size: "lead" }, "no-such-item"));

    expect(res.statusCode).toBe(404);
    expect((await roles.list("2027")).roles).toEqual([]);
  });

  it("returns 404 for a production with no running order, or an invalid production id", async () => {
    const { handler } = setUp();
    const hook = { name: "Captain Hook", size: "lead" };

    expect((await handler(request(hook, pirateSketch, "1999"))).statusCode).toBe(404);
    expect((await handler(request(hook, pirateSketch, "../etc"))).statusCode).toBe(404);
  });
});

describe("add role handler with a name already used", () => {
  it("refuses a repeated name in the same item with 400 and name-taken, storing nothing", async () => {
    const { roles, handler } = setUp();
    await handler(request({ name: "Captain Hook", size: "lead" }));

    const res = await handler(request({ name: "CAPTAIN HOOK", size: "cameo" }));

    expect(res.statusCode).toBe(400);
    expect(AddRoleRefusal.parse(JSON.parse(res.body ?? ""))).toEqual({ error: "name-taken" });
    expect((await roles.list("2027")).roles).toHaveLength(1);
  });
});
