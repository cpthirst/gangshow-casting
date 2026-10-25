import { Prop } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createAddProp } from "./add-prop.ts";
import { inMemoryPropStore } from "./prop-store.ts";
import { aRunningOrder, itemId } from "./running-order.fixture.ts";
import { inMemoryRunningOrderStore } from "./running-order-store.ts";

const pirateSketch = itemId("Pirate Sketch");

const request = (body: unknown, item = pirateSketch, productionId = "2027") => ({
  pathParameters: { productionId, itemId: item },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

function setUp() {
  const props = inMemoryPropStore();
  const runningOrders = inMemoryRunningOrderStore([
    aRunningOrder(7, { first: ["Opening Number", "Pirate Sketch"] }),
  ]);
  return { props, handler: createAddProp(props, runningOrders) };
}

describe("add prop handler", () => {
  it("returns 201 with the new prop and its id, and stores it", async () => {
    const { props, handler } = setUp();

    const res = await handler(request({ name: "Treasure chest" }));

    expect(res.statusCode).toBe(201);
    const added = Prop.parse(JSON.parse(res.body ?? ""));
    expect(added).toEqual({ id: 1, itemId: pirateSketch, name: "Treasure chest" });
    expect((await props.list("2027")).props).toEqual([added]);
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
    ["malformed JSON", "{not json"],
  ])("rejects %s with 400, storing nothing", async (_case, body) => {
    const { props, handler } = setUp();

    expect((await handler(request(body))).statusCode).toBe(400);
    expect((await props.list("2027")).props).toEqual([]);
  });

  it("returns 404 for an item that isn't in the latest saved running order", async () => {
    const { props, handler } = setUp();

    const res = await handler(request({ name: "Parrot" }, itemId("Finale")));

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
