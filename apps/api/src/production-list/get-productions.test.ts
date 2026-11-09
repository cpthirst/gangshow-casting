import { ProductionList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createGetProductions } from "./get-productions.ts";
import { inMemoryProductionListStore } from "./production-list-store.ts";

const read = async (productions?: string[]) => {
  const res = await createGetProductions(inMemoryProductionListStore(productions))({});
  expect(res.statusCode).toBe(200);
  return ProductionList.parse(JSON.parse(res.body ?? ""));
};

describe("GET /api/productions", () => {
  it("holds 2027, the production the hosted app already has", async () => {
    expect((await read()).productions).toContain("2027");
  });

  it("holds every production in the list", async () => {
    expect((await read(["2027", "2028"])).productions).toEqual(["2027", "2028"]);
  });
});
