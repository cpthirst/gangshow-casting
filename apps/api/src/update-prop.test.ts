import { Prop, type PropList, type Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import { inMemoryPropStore } from "./prop-store.ts";
import { inMemoryRoleStore } from "./role-store.ts";
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

const request = (propId: string, body: unknown, productionId = "2027") => ({
  pathParameters: { productionId, propId },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

function setUp() {
  const initial: PropList = {
    productionId: "2027",
    props: [{ id: 4, itemId: "pirate-sketch", name: "Telescope", roleIds: [captain.id] }],
  };
  const props = inMemoryPropStore([initial]);
  const roles = inMemoryRoleStore([{ productionId: "2027", roles: [captain, pirate1, soloist] }]);
  return { props, initial, handler: createUpdateProp(props, roles) };
}

describe("update prop handler", () => {
  it("returns 200 with the prop's new name and roles, and stores them", async () => {
    const { props, handler } = setUp();

    const res = await handler(request("4", { name: "Spyglass", roleIds: [pirate1.id] }));

    expect(res.statusCode).toBe(200);
    const updated = { id: 4, itemId: "pirate-sketch", name: "Spyglass", roleIds: [pirate1.id] };
    expect(Prop.parse(JSON.parse(res.body ?? ""))).toEqual(updated);
    expect((await props.list("2027")).props).toEqual([updated]);
  });

  it.each([
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
