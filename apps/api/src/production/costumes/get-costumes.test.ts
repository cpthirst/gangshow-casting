import { CostumeList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { aCostume } from "./costume-store.contract.ts";
import { inMemoryCostumeStore } from "./costume-store.ts";
import { createGetCostumes } from "./get-costumes.ts";

const request = (productionId: string) => ({ pathParameters: { productionId } });

// Made-up: Alex Morgan (1) as Captain Hook (7) in Opening Number, in production 2027.
const alexAsHook = aCostume("itm_opening-number", 7, 1);

describe("get costumes handler", () => {
  it("returns the production's costumes", async () => {
    const saved = { productionId: "2027", costumes: [alexAsHook] };
    const handler = createGetCostumes(inMemoryCostumeStore([saved]));

    const res = await handler(request("2027"));

    expect(res.statusCode).toBe(200);
    expect(CostumeList.parse(JSON.parse(res.body ?? ""))).toEqual(saved);
  });

  it("leaves out another production's costumes", async () => {
    const handler = createGetCostumes(
      inMemoryCostumeStore([{ productionId: "2027", costumes: [alexAsHook] }]),
    );

    const res = await handler(request("2028"));

    expect(CostumeList.parse(JSON.parse(res.body ?? "")).costumes).toEqual([]);
  });

  it("answers 404 for a production id that isn't valid", async () => {
    const handler = createGetCostumes(inMemoryCostumeStore());

    expect((await handler(request("../x"))).statusCode).toBe(404);
  });
});
