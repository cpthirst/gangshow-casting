import { describe, expect, it } from "vitest";
import {
  accessFrom,
  accountRouteKeys,
  adminOnlyRouteKeys,
  CASTING_PERMISSIONS,
  isAccountRoute,
  isReadRoute,
  isRefusalAsReadOnly,
  localAccessFrom,
  localAccessHeader,
  mayChange,
  needOf,
  PROPS_PERMISSIONS,
  permissions,
  type RouteNeeds,
  readOnlyMayUse,
  refusalFor,
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
      "PUT /api/accounts/{username}/access",
      "PUT /api/accounts/{username}/enabled",
    ]);
  });
});

describe("accountRouteKeys", () => {
  it("lists the account routes, which are in the route list and all admin-only", () => {
    expect([...accountRouteKeys].sort()).toEqual([
      "GET /api/accounts",
      "POST /api/accounts",
      "POST /api/accounts/{username}/password",
      "PUT /api/accounts/{username}/access",
      "PUT /api/accounts/{username}/enabled",
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
      ["tech", "wardrobe"],
      ["tech", "wardrobe"],
    ],
    [[], []],
    // Unknown groups add nothing.
    [["crew", "Casting", "props", "stage"], ["stage"]],
    // Costume became Wardrobe (production-overview FR1): the old group grants nothing.
    [["costume"], []],
    [["costume", "tech"], ["tech"]],
    [["director"], ["director"]],
    [
      ["director", "casting"],
      ["casting", "director"],
    ],
    // An Admin's extra Director group is ignored, as any other group is.
    [["admin", "director"], "admin"],
    // While the retiring read-only group exists, it grants nothing and cancels the rest.
    [["read-only"], []],
    [["read-only", "casting", "stage"], []],
    [["admin", "read-only"], []],
  ])("gives %j the access %j", (groups, access) => {
    expect(accessFrom(groups)).toEqual(access);
  });
});

describe("routeNeeds", () => {
  it("names one or more permissions, any of which allows it, or admin, for every route that isn't open to everyone", () => {
    for (const key of routeKeys.filter((key) => !readOnlyMayUse(key))) {
      const need = routeNeeds[key];
      if (need === "admin") continue;
      expect(need, key).not.toHaveLength(0);
      for (const permission of need ?? []) expect(permissions, key).toContain(permission);
    }
  });

  it("lets a Director use every department's change route, but none of Casting's (production-scenery FR2)", () => {
    for (const key of routeKeys) {
      const need = needOf(key);
      if (need === undefined || need === "admin" || need === CASTING_PERMISSIONS) continue;
      expect(need, key).toContain("director");
    }
    expect(CASTING_PERMISSIONS).not.toContain("director");
  });

  it.each([
    "POST /api/productions/{productionId}/items/{itemId}/props",
    "PUT /api/productions/{productionId}/props/{propId}",
    "DELETE /api/productions/{productionId}/props/{propId}",
    "PUT /api/productions/{productionId}/items/{itemId}/props-notes",
  ])("has %s need Stage or Director", (key) => {
    expect(needOf(key)).toEqual(["stage", "director"]);
  });

  it("leaves reading props notes open to everyone", () => {
    expect(routeKeys).toContain("GET /api/productions/{productionId}/props-notes");
    expect(needOf("GET /api/productions/{productionId}/props-notes")).toBeUndefined();
  });

  it("has every other change route today need Casting, or stay admin-only", () => {
    const changes = routeKeys.filter(
      (key) => !readOnlyMayUse(key) && needOf(key) !== PROPS_PERMISSIONS,
    );
    const needsCasting = (key: string) => needOf(key) === CASTING_PERMISSIONS;
    expect(changes.filter(needsCasting).sort()).toEqual([
      "DELETE /api/productions/{productionId}/roles/{roleId}",
      "POST /api/productions/{productionId}/cast",
      "POST /api/productions/{productionId}/items/{itemId}/roles",
      "PUT /api/productions/{productionId}/cast/{castId}",
      "PUT /api/productions/{productionId}/items/{itemId}/notes",
      "PUT /api/productions/{productionId}/roles/{roleId}",
    ]);
    expect(
      changes.filter((key) => !needsCasting(key)).every((key) => needOf(key) === "admin"),
    ).toBe(true);
  });

  it("leaves the reads and recording usage open to everyone, but the admin-only reads", () => {
    for (const key of routeKeys.filter(readOnlyMayUse)) {
      const adminOnlyRead = key === "GET /api/accounts" || key === "GET /api/usage";
      expect(needOf(key), key).toBe(adminOnlyRead ? "admin" : undefined);
    }
  });

  it("needs an admin for a change route missing from the table, so a gap fails safe", () => {
    expect(needOf("PUT /api/productions/{productionId}/anything-new/{id}")).toBe("admin");
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

describe("mayChange", () => {
  it.each([
    ["admin", "stage", true],
    [["casting"], "casting", true],
    [["casting", "stage"], "stage", true],
    [["casting"], "stage", false],
    [[], "casting", false],
  ] as const)("lets %j change %s: %s", (access, permission, allowed) => {
    expect(mayChange(access === "admin" ? access : [...access], permission)).toBe(allowed);
  });

  it.each([
    [["director"], true],
    [["stage"], true],
    [["casting", "tech", "wardrobe"], false],
  ] as const)("lets %j change what Stage or Director may: %s", (access, allowed) => {
    expect(mayChange([...access], ["stage", "director"])).toBe(allowed);
  });
});

describe("the local access header", () => {
  it.each([
    ["admin", "admin"],
    [["stage", "tech"], "stage,tech"],
    [[], ""],
  ] as const)("sends %j as %j, and reads it back the same", (access, sent) => {
    const chosen = access === "admin" ? access : [...access];

    expect([localAccessHeader(chosen), localAccessFrom(localAccessHeader(chosen))]).toEqual([
      sent,
      chosen,
    ]);
  });

  it("acts for an admin when no access is sent, as the local app starts", () => {
    expect(localAccessFrom(undefined)).toBe("admin");
  });

  it.each([["owner"], ["casting,owner"], ["casting,casting"], [["admin", "casting"]]])(
    "treats access it doesn't know, %j, as read-only",
    (sent) => {
      expect(localAccessFrom(sent)).toEqual([]);
    },
  );
});

describe("refusalFor", () => {
  it("says the casting can be viewed but not changed", () => {
    expect(refusalFor("casting")).toBe("You can view the casting, but not change it.");
  });

  it("says the props can be viewed but not changed, for Stage", () => {
    expect(refusalFor("stage")).toBe("You can view the props, but not change them.");
  });

  it("falls back to a general line for a department without its own", () => {
    expect(refusalFor("tech")).toBe("You can view this, but not change it.");
    expect(refusalFor("director")).toBe("You can view this, but not change it.");
  });

  it("names the first permission a route lists, so props say the props are view-only", () => {
    expect(refusalFor(["stage", "director"])).toBe("You can view the props, but not change them.");
  });
});

describe("isRefusalAsReadOnly", () => {
  it("recognises every department's refusal, and nothing else", () => {
    expect(permissions.every((permission) => isRefusalAsReadOnly(refusalFor(permission)))).toBe(
      true,
    );
    expect(isRefusalAsReadOnly("Only admins can do this.")).toBe(false);
    expect(isRefusalAsReadOnly(undefined)).toBe(false);
  });
});
