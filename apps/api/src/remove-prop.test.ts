import type { PropList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { inMemoryPropStore } from "./prop-store.ts";
import { createRemoveProp } from "./remove-prop.ts";

const request = (propId: string, productionId = "2027") => ({
  pathParameters: { productionId, propId },
});

const telescope = { id: 4, itemId: "pirate-sketch", name: "Telescope", roleIds: [] };
const parrot = { id: 5, itemId: "pirate-sketch", name: "Parrot", roleIds: [] };

function setUp() {
  const initial: PropList = { productionId: "2027", props: [telescope, parrot] };
  const props = inMemoryPropStore([initial]);
  return { props, initial, handler: createRemoveProp(props) };
}

describe("remove prop handler", () => {
  it("returns 204 and removes the prop", async () => {
    const { props, handler } = setUp();

    expect((await handler(request("4"))).statusCode).toBe(204);
    expect((await props.list("2027")).props).toEqual([parrot]);
  });

  it("returns 404 for a prop that's already gone, removing nothing", async () => {
    const { props, initial, handler } = setUp();

    expect((await handler(request("9"))).statusCode).toBe(404);
    expect(await props.list("2027")).toEqual(initial);
  });

  it("returns 404 for an invalid production id or prop id", async () => {
    const { handler } = setUp();

    expect((await handler(request("4", "../etc"))).statusCode).toBe(404);
    expect((await handler(request("four"))).statusCode).toBe(404);
  });
});
