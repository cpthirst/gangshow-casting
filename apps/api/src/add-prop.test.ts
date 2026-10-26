import { Prop, type Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createAddProp } from "./add-prop.ts";
import { inMemoryPropStore } from "./prop-store.ts";
import { inMemoryRoleStore } from "./role-store.ts";
import { aRunningOrder, itemId } from "./running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "./running-order-store.ts";

const pirateSketch = itemId("Pirate Sketch");
const finale = itemId("Finale");

const aRole = (id: number, item: string, name: string): Role => ({
  id,
  itemId: item,
  name,
  size: "support",
  castMemberIds: [],
  revision: 1,
});
const captain = aRole(1, pirateSketch, "Captain");
const pirate1 = aRole(2, pirateSketch, "Pirate 1");
const soloist = aRole(3, finale, "Soloist");

const request = (body: unknown, item = pirateSketch, productionId = "2027") => ({
  pathParameters: { productionId, itemId: item },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

function setUp() {
  const props = inMemoryPropStore();
  const runningOrders = inMemoryRunningOrderStore([
    aRunningOrder(7, { first: ["Opening Number", "Pirate Sketch"] }),
  ]);
  const roles = inMemoryRoleStore([{ productionId: "2027", roles: [captain, pirate1, soloist] }]);
  return { props, handler: createAddProp(props, runningOrders, roles) };
}

describe("add prop handler", () => {
  it("returns 201 with the new prop and its id, and stores it", async () => {
    const { props, handler } = setUp();

    const res = await handler(request({ name: "Treasure chest" }));

    expect(res.statusCode).toBe(201);
    const added = Prop.parse(JSON.parse(res.body ?? ""));
    expect(added).toEqual({ id: 1, itemId: pirateSketch, name: "Treasure chest", roleIds: [] });
    expect((await props.list("2027")).props).toEqual([added]);
  });

  it("links the new prop to the item's roles given", async () => {
    const { props, handler } = setUp();

    const res = await handler(request({ name: "Telescope", roleIds: [captain.id, pirate1.id] }));

    expect(res.statusCode).toBe(201);
    expect(Prop.parse(JSON.parse(res.body ?? "")).roleIds).toEqual([captain.id, pirate1.id]);
    expect((await props.list("2027")).props[0]?.roleIds).toEqual([captain.id, pirate1.id]);
  });

  it.each([
    ["a role from another item", [captain.id, soloist.id]],
    ["a role that doesn't exist", [99]],
  ])("refuses %s with 400, storing nothing", async (_case, roleIds) => {
    const { props, handler } = setUp();

    expect((await handler(request({ name: "Telescope", roleIds }))).statusCode).toBe(400);
    expect((await props.list("2027")).props).toEqual([]);
  });

  it("stores the name without surrounding spaces", async () => {
    const { handler } = setUp();

    const res = await handler(request({ name: "  Parrot " }));

    expect(Prop.parse(JSON.parse(res.body ?? "")).name).toBe("Parrot");
  });

  it.each([
    ["no name", {}],
    ["an empty name", { name: "" }],
    ["a name of only spaces", { name: "   " }],
    ["a name over 80 characters", { name: "x".repeat(81) }],
    ["an extra field", { name: "Parrot", castMemberIds: [1] }],
    ["a role listed twice", { name: "Parrot", roleIds: [1, 1] }],
    ["malformed JSON", "{not json"],
  ])("rejects %s with 400, storing nothing", async (_case, body) => {
    const { props, handler } = setUp();

    expect((await handler(request(body))).statusCode).toBe(400);
    expect((await props.list("2027")).props).toEqual([]);
  });

  it("returns 404 for an item that isn't in the latest saved running order", async () => {
    const { props, handler } = setUp();

    const res = await handler(request({ name: "Parrot" }, finale));

    expect(res.statusCode).toBe(404);
    expect((await props.list("2027")).props).toEqual([]);
  });

  it("returns 404 for a production with no saved running order", async () => {
    const { handler } = setUp();

    expect((await handler(request({ name: "Parrot" }, pirateSketch, "2028"))).statusCode).toBe(404);
  });

  it("returns 404 for a production id that isn't valid", async () => {
    const { handler } = setUp();

    expect((await handler(request({ name: "Parrot" }, pirateSketch, "../etc"))).statusCode).toBe(
      404,
    );
  });
});
