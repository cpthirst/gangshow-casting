import { describe, expect, it } from "vitest";
import { isChangeWithinProduction, needOf, routeKeys } from "./api-routes.ts";
import {
  BACKUP_WINDOW_DAYS,
  mayChangeProduction,
  mayDeleteProduction,
  mayStartProduction,
  NewProduction,
  newestFirst,
  newestProduction,
  PastProductionRefusal,
  ProductionList,
  pastProductionRefusal,
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

describe("a past production", () => {
  it("can be changed only if it's the newest", () => {
    expect(mayChangeProduction("2028", ["2027", "2028"])).toBe(true);
    expect(mayChangeProduction("2027", ["2027", "2028"])).toBe(false);
  });

  it("can't be changed if the list doesn't hold it, so a mistyped address changes nothing", () => {
    expect(mayChangeProduction("1999", ["2027", "2028"])).toBe(false);
  });

  it("is refused in the department refusals' words, with the list to catch up from", () => {
    const refusal = pastProductionRefusal(["2027", "2028"]);

    expect(refusal).toEqual({
      message: "You can view this past production, but not change it.",
      productions: ["2027", "2028"],
    });
    expect(PastProductionRefusal.safeParse(refusal).success).toBe(true);
  });

  it("is recognised by the list it carries, never by its wording", () => {
    const recognised = (body: unknown) => PastProductionRefusal.safeParse(body).success;

    expect(recognised(pastProductionRefusal(["2027", "2028"]))).toBe(true);
    expect(recognised({ message: "You can view this past production" })).toBe(false);
    expect(recognised({ message: "x", department: "casting" })).toBe(false);
  });

  it("lists the newest first", () => {
    expect(newestFirst(["2027", "2029", "2028"])).toEqual(["2029", "2028", "2027"]);
  });
});

describe("deleting a production", () => {
  it("is a route only admins may use", () => {
    expect(routeKeys).toContain("DELETE /api/productions/{productionId}");
    expect(needOf("DELETE /api/productions/{productionId}")).toBe("admin");
  });

  it("is about the production as a whole, so a past production can be deleted", () => {
    expect(isChangeWithinProduction("DELETE /api/productions/{productionId}")).toBe(false);
  });

  it("is allowed for any production but the newest", () => {
    expect(mayDeleteProduction("2027", ["2027", "2028"])).toBe(true);
    expect(mayDeleteProduction("2028", ["2027", "2028"])).toBe(false);
  });

  it("can leave a production not finished, which the list names apart", () => {
    const list = { productions: ["2028"], deleting: ["2027"] };

    expect(ProductionList.parse(list)).toEqual(list);
    expect(ProductionList.parse({ productions: ["2028"] })).toEqual({ productions: ["2028"] });
  });

  it("leaves copies in backups for the table's point-in-time recovery period", () => {
    expect(BACKUP_WINDOW_DAYS).toBe(7);
  });
});
