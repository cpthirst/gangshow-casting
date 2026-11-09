import { describe, expect, it } from "vitest";
import { routeKeys } from "./api-routes.ts";
import { newestProduction, ProductionList } from "./production.ts";

describe("the list of productions", () => {
  it("names each production by its four-digit year", () => {
    expect(ProductionList.safeParse({ productions: ["2027", "2028"] }).success).toBe(true);
    expect(ProductionList.safeParse({ productions: ["next-year"] }).success).toBe(false);
    expect(ProductionList.safeParse({ productions: ["227"] }).success).toBe(false);
  });

  it("always holds at least one production", () => {
    expect(ProductionList.safeParse({ productions: [] }).success).toBe(false);
  });

  it("has a route of its own", () => {
    expect(routeKeys).toContain("GET /api/productions");
  });
});

describe("newestProduction", () => {
  it("is the highest year, whatever order the list is in", () => {
    expect(newestProduction(["2028", "2029", "2027"])).toBe("2029");
  });
});
