import { describe, expect, it } from "vitest";
import { needOf, routeKeys } from "./api-routes.ts";
import {
  mayStartProduction,
  NewProduction,
  newestProduction,
  ProductionList,
  startRefusal,
} from "./production.ts";

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

describe("starting a production", () => {
  it("is a route only admins may use", () => {
    expect(routeKeys).toContain("POST /api/productions");
    expect(needOf("POST /api/productions")).toBe("admin");
  });

  it("asks only for the year", () => {
    expect(NewProduction.safeParse({ year: "2028" }).success).toBe(true);
    expect(NewProduction.safeParse({ year: 2028 }).success).toBe(false);
    expect(NewProduction.safeParse({ year: "2028", name: "Next" }).success).toBe(false);
  });

  it("allows a four-digit year later than the newest", () => {
    expect(mayStartProduction("2029", ["2027", "2028"])).toBe(true);
  });

  it.each(["2028", "2026", "next year", "20290", "29", ""])("refuses %j after 2028", (year) => {
    expect(mayStartProduction(year, ["2027", "2028"])).toBe(false);
  });

  it("says what year would do", () => {
    expect(startRefusal(["2028", "2027"])).toBe(
      "The year must be a four-digit year later than 2028.",
    );
  });
});
