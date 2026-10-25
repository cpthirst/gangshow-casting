import { describe, expect, it } from "vitest";
import {
  accessFrom,
  accountRouteKeys,
  adminOnlyRouteKeys,
  isAccountRoute,
  isReadRoute,
  needOf,
  type RouteNeeds,
  readOnlyMayUse,
  roleFrom,
  routeKeys,
  routeNeeds,
} from "./api-routes.ts";

describe("adminOnlyRouteKeys", () => {
  it("keeps managing accounts, deleting a cast member, saving a running-order version and reading usage for admins", () => {
    expect([...adminOnlyRouteKeys].sort()).toEqual([
      "DELETE /api/productions/{productionId}/cast/{castId}",
      "GET /api/accounts",
      "GET /api/usage",
      "POST /api/accounts",
      "POST /api/accounts/{username}/password",
      "POST /api/productions/{productionId}/running-order/versions",
      "PUT /api/accounts/{username}/enabled",
      "PUT /api/accounts/{username}/role",
    ]);
  });
});

describe("accountRouteKeys", () => {
  it("lists the account routes, which are in the route list and all admin-only", () => {
    expect([...accountRouteKeys].sort()).toEqual([
      "GET /api/accounts",
      "POST /api/accounts",
      "POST /api/accounts/{username}/password",
      "PUT /api/accounts/{username}/enabled",
      "PUT /api/accounts/{username}/role",
    ]);
    for (const key of accountRouteKeys) {
      expect(routeKeys).toContain(key);
      expect(adminOnlyRouteKeys).toContain(key);
    }
  });
});

describe("isAccountRoute", () => {
  it("says whether a route is one of the account routes", () => {
    expect(isAccountRoute("POST /api/accounts")).toBe(true);
    expect(isAccountRoute("GET /api/health")).toBe(false);
    expect(isAccountRoute("$default")).toBe(false);
  });
});

describe("accessFrom", () => {
  it.each([
    [["admin"], "admin"],
    // Admin is exclusive: an admin's other groups are ignored.
    [["casting", "admin", "stage"], "admin"],
    [["casting"], ["casting"]],
    [["stage"], ["stage"]],
    [
      ["stage", "casting"],
      ["casting", "stage"],
    ],
    [
      ["tech", "costume"],
      ["tech", "costume"],
    ],
    [[], []],
    // Unknown groups add nothing.
    [["crew", "Casting", "props", "stage"], ["stage"]],
    // While the retiring read-only group exists, it grants nothing and cancels the rest.
    [["read-only"], []],
    [["read-only", "casting", "stage"], []],
    [["admin", "read-only"], []],
  ])("gives %j the access %j", (groups, access) => {
    expect(accessFrom(groups)).toEqual(access);
  });
});

describe("routeNeeds", () => {
  it("names the permission, or admin, for every route that isn't open to everyone", () => {
    for (const key of routeKeys.filter((key) => !readOnlyMayUse(key))) {
      expect(["admin", "casting", "stage", "tech", "costume"], key).toContain(routeNeeds[key]);
    }
  });

  it("has every change route today need Casting, or stay admin-only", () => {
    const changes = routeKeys.filter((key) => !readOnlyMayUse(key));
    expect(changes.filter((key) => needOf(key) === "casting").sort()).toEqual([
      "DELETE /api/productions/{productionId}/roles/{roleId}",
      "POST /api/productions/{productionId}/cast",
      "POST /api/productions/{productionId}/items/{itemId}/roles",
      "PUT /api/productions/{productionId}/cast/{castId}",
      "PUT /api/productions/{productionId}/items/{itemId}/notes",
      "PUT /api/productions/{productionId}/roles/{roleId}",
    ]);
    expect(
      changes.filter((key) => needOf(key) !== "casting").every((key) => needOf(key) === "admin"),
    ).toBe(true);
  });

  it("leaves the reads and recording usage open to everyone, but the admin-only reads", () => {
    for (const key of routeKeys.filter(readOnlyMayUse)) {
      const adminOnlyRead = key === "GET /api/accounts" || key === "GET /api/usage";
      expect(needOf(key), key).toBe(adminOnlyRead ? "admin" : undefined);
    }
  });

  it("needs an admin for a change route missing from the table, so a gap fails safe", () => {
    expect(needOf("PUT /api/productions/{productionId}/props/{propId}")).toBe("admin");
    expect(needOf("POST /api/anything-new")).toBe("admin");
    expect(needOf("GET /api/anything-new")).toBeUndefined();
  });

  it("is typed so a change route missing from it fails the typecheck", () => {
    // The point is the compile-time check: the @ts-expect-error fails typecheck if it's unneeded.
    const { "POST /api/productions/{productionId}/cast": _missing, ...rest } = routeNeeds;
    // @ts-expect-error a change route has no entry
    const incomplete: RouteNeeds = rest;
    expect(Object.keys(incomplete)).not.toContain("POST /api/productions/{productionId}/cast");
  });
});

describe("roleFrom", () => {
  it.each([
    [["admin"], "admin"],
    [["casting"], "casting"],
    [["read-only"], "read-only"],
    [["casting", "admin"], "admin"],
    // Until stage-props.E2.S1 shows permissions, only Casting makes a Casting Team Member.
    [["casting", "stage"], "casting"],
    [["stage"], "read-only"],
    [["tech", "costume"], "read-only"],
    // An explicit read-only group wins, so a mistaken extra group can't widen access.
    [["read-only", "casting"], "read-only"],
    [["admin", "read-only"], "read-only"],
  ])("gives %j the %s role", (groups, role) => {
    expect(roleFrom(groups)).toBe(role);
  });

  it.each([[[]], [["crew"]], [["Admin"]], [["superadmin"]]])(
    "treats %j, which names no role, as read-only",
    (groups) => {
      expect(roleFrom(groups)).toBe("read-only");
    },
  );
});

describe("isReadRoute", () => {
  it("counts GET routes and the casting grid export, which changes nothing, as reads", () => {
    expect(routeKeys.filter((key) => key.startsWith("GET ")).every(isReadRoute)).toBe(true);
    expect(routeKeys.filter((key) => !key.startsWith("GET ") && isReadRoute(key))).toEqual([
      "POST /api/productions/{productionId}/casting-grid/export",
    ]);
    expect(isReadRoute("PUT /api/productions/{productionId}/cast/{castId}")).toBe(false);
    expect(isReadRoute("POST /api/productions/{productionId}/running-order/versions")).toBe(false);
  });
});

describe("readOnlyMayUse", () => {
  it("lets read-only members use every read, and record their own usage, but nothing else", () => {
    expect(routeKeys.filter(readOnlyMayUse).sort()).toEqual(
      [...routeKeys.filter(isReadRoute), "POST /api/usage"].sort(),
    );
    expect(isReadRoute("POST /api/usage")).toBe(false);
  });
});
