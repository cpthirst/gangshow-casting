import { Prop, type PropList, type Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import { inMemoryRoleStore } from "#/casting/roles/role-store.ts";
import { inMemoryPropStore } from "./prop-store.ts";
import { createUpdateProp } from "./update-prop.ts";

const aRole = (id: number, itemId: string, name: string): Role => ({
  id,
  itemId,
  name,
  size: "support",
  castMemberIds: [],
  revision: 1,
});
const captain = aRole(1, "pirate-sketch", "Captain");
const pirate1 = aRole(2, "pirate-sketch", "Pirate 1");
const soloist = aRole(3, "finale", "Soloist");
// Made-up cast member ids: Jo, Kim and Alex are villagers; Sam is the baker.
const [sam, jo, kim, alex] = [1, 3, 4, 5];
const villagers: Role = {
  ...aRole(4, "pirate-sketch", "Villagers"),
  size: "ensemble",
  castMemberIds: [jo, kim, alex],
};
const baker: Role = { ...aRole(5, "pirate-sketch", "Baker"), castMemberIds: [sam] };
const crier: Role = { ...aRole(6, "pirate-sketch", "Crier"), castMemberIds: [jo] };

const request = (propId: string, body: unknown, productionId = "2027") => ({
  pathParameters: { productionId, propId },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

function setUp() {
  const initial: PropList = {
    productionId: "2027",
    props: [
      {
        id: 4,
        itemId: "pirate-sketch",
        name: "Telescope",
        quantity: 1,
        roleIds: [captain.id],
        carrierIds: [],
      },
    ],
  };
  const props = inMemoryPropStore([initial]);
  const roles = inMemoryRoleStore([
    { productionId: "2027", roles: [captain, pirate1, soloist, villagers, baker, crier] },
  ]);
  return { props, initial, handler: createUpdateProp(props, roles) };
}

describe("update prop handler", () => {
  it("returns 200 with the prop's new name and roles, and stores them", async () => {
    const { props, handler } = setUp();

    const res = await handler(request("4", { name: "Spyglass", roleIds: [pirate1.id] }));

    expect(res.statusCode).toBe(200);
    const updated = {
      id: 4,
      itemId: "pirate-sketch",
      name: "Spyglass",
      quantity: 1,
      roleIds: [pirate1.id],
      carrierIds: [],
    };
    expect(Prop.parse(JSON.parse(res.body ?? ""))).toEqual(updated);
    expect((await props.list("2027")).props).toEqual([updated]);
  });

  it("changes the prop's quantity", async () => {
    const { props, handler } = setUp();

    const res = await handler(request("4", { name: "Telescope", quantity: 6, roleIds: [] }));

    expect(Prop.parse(JSON.parse(res.body ?? "")).quantity).toBe(6);
    expect((await props.list("2027")).props[0]?.quantity).toBe(6);
  });

  it("changes who carries the prop", async () => {
    const { props, handler } = setUp();
    const basket = {
      name: "Bread basket",
      quantity: 1,
      roleIds: [villagers.id],
      carrierIds: [alex],
    };

    const res = await handler(request("4", basket));

    expect(Prop.parse(JSON.parse(res.body ?? "")).carrierIds).toEqual([alex]);
    expect((await props.list("2027")).props[0]?.carrierIds).toEqual([alex]);
  });

  it.each([
    [
      "a carrier who plays another of the item's roles",
      { name: "Bread basket", quantity: 1, roleIds: [villagers.id], carrierIds: [sam] },
    ],
    [
      "more carriers than the quantity",
      { name: "Bread basket", quantity: 1, roleIds: [villagers.id], carrierIds: [jo, kim] },
    ],
    [
      "a carrier who plays one of the prop's named parts",
      { name: "Lantern", quantity: 2, roleIds: [villagers.id, baker.id], carrierIds: [sam] },
    ],
    [
      "more carriers than the named parts leave room for",
      { name: "Lantern", quantity: 2, roleIds: [villagers.id, baker.id], carrierIds: [jo, kim] },
    ],
    [
      "a quantity below the prop's named parts",
      { name: "Lantern", quantity: 1, roleIds: [baker.id, crier.id] },
    ],
    ["a quantity of 0", { name: "Spyglass", quantity: 0, roleIds: [] }],
    ["a quantity of 100", { name: "Spyglass", quantity: 100, roleIds: [] }],
    ["a quantity of 2.5", { name: "Spyglass", quantity: 2.5, roleIds: [] }],
    ["an empty name", { name: "", roleIds: [] }],
    ["a name of only spaces", { name: "  ", roleIds: [] }],
    ["a name over 80 characters", { name: "x".repeat(81), roleIds: [] }],
    ["a role listed twice", { name: "Spyglass", roleIds: [1, 1] }],
    ["another item's role", { name: "Spyglass", roleIds: [soloist.id] }],
    ["a role that doesn't exist", { name: "Spyglass", roleIds: [99] }],
    ["an id in the body", { id: 9, name: "Spyglass", roleIds: [] }],
    ["a body that isn't JSON", "{"],
  ])("refuses %s with 400, changing nothing", async (_case, body) => {
    const { props, initial, handler } = setUp();

    expect((await handler(request("4", body))).statusCode).toBe(400);
    expect(await props.list("2027")).toEqual(initial);
  });

  it("refuses a quantity below the carriers the prop already has, changing nothing", async () => {
    const lantern = { name: "Lantern", quantity: 3, roleIds: [villagers.id] };
    const { props, handler } = setUp();
    const carried = await handler(request("4", { ...lantern, carrierIds: [jo, kim, alex] }));
    expect(carried.statusCode).toBe(200);
    const saved = await props.list("2027");

    const res = await handler(
      request("4", { ...lantern, quantity: 2, carrierIds: [jo, kim, alex] }),
    );

    expect(res.statusCode).toBe(400);
    expect(await props.list("2027")).toEqual(saved);
  });

  it("returns 404 for a prop that's gone", async () => {
    const { props, initial, handler } = setUp();

    expect((await handler(request("5", { name: "Spyglass", roleIds: [] }))).statusCode).toBe(404);
    expect(await props.list("2027")).toEqual(initial);
  });

  it("returns 404 for an invalid production id or prop id", async () => {
    const { handler } = setUp();
    const body = { name: "Spyglass", roleIds: [] };

    expect((await handler(request("4", body, "../etc"))).statusCode).toBe(404);
    expect((await handler(request("four", body))).statusCode).toBe(404);
  });
});
