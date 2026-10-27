import { PropList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createGetProps } from "./get-props.ts";
import { inMemoryPropStore } from "./prop-store.ts";

const treasureChest = {
  id: 1,
  itemId: "pirate-sketch",
  name: "Treasure chest",
  quantity: 1,
  roleIds: [],
};

describe("get props handler", () => {
  it("returns every item's props in the production", async () => {
    const get = createGetProps(
      inMemoryPropStore([{ productionId: "2027", props: [treasureChest] }]),
    );

    const res = await get({ pathParameters: { productionId: "2027" } });

    expect(res.statusCode).toBe(200);
    expect(PropList.parse(JSON.parse(res.body ?? ""))).toEqual({
      productionId: "2027",
      props: [treasureChest],
    });
  });

  it("returns no props for a production with none", async () => {
    const res = await createGetProps(inMemoryPropStore())({
      pathParameters: { productionId: "2027" },
    });

    expect(JSON.parse(res.body ?? "")).toEqual({ productionId: "2027", props: [] });
  });

  it("returns 404 for a production id that isn't valid", async () => {
    const res = await createGetProps(inMemoryPropStore())({
      pathParameters: { productionId: "../etc" },
    });

    expect(res.statusCode).toBe(404);
  });
});
