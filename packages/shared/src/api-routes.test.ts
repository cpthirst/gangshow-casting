import { describe, expect, it } from "vitest";
import {
  accountRouteKeys,
  adminOnlyRouteKeys,
  isAccountRoute,
  isReadRoute,
  readOnlyMayUse,
  roleFrom,
  routeKeys,
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

describe("roleFrom", () => {
  it.each([
    [["admin"], "admin"],
    [["casting"], "casting"],
    [["read-only"], "read-only"],
    [["casting", "admin"], "admin"],
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
