import { describe, expect, it } from "vitest";
import {
  accessFrom,
  accountRouteKeys,
  adminOnlyRouteKeys,
  departmentIds,
  departments,
  isAccountRoute,
  isChangeWithinProduction,
  isReadRoute,
  isRefusalAsReadOnly,
  localAccessFrom,
  localAccessHeader,
  mayChange,
  mayChangeDepartment,
  needOf,
  type RouteNeeds,
  readOnlyMayUse,
  readOnlyRefusal,
  routeKeys,
  routeNeeds,
} from "./api-routes.ts";

describe("adminOnlyRouteKeys", () => {
  it("keeps managing accounts, starting or deleting a production, deleting a cast member, saving a running-order version and reading usage for admins", () => {
    expect([...adminOnlyRouteKeys].sort()).toEqual([
      "DELETE /api/productions/{productionId}",
      "DELETE /api/productions/{productionId}/cast/{castId}",
      "GET /api/accounts",
      "GET /api/usage",
      "POST /api/accounts",
      "POST /api/accounts/{username}/password",
      "POST /api/productions",
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
  it("names a department, or admin, for every route that isn't open to everyone", () => {
    for (const key of routeKeys.filter((key) => !readOnlyMayUse(key))) {
      const need = routeNeeds[key];
      expect([...departmentIds, "admin"], key).toContain(need);
    }
  });

  it("lets a Director use every department's change route, but none of Casting's (production-scenery FR2)", () => {
    for (const key of routeKeys) {
      const need = needOf(key);
      if (need === undefined || need === "admin" || need === "casting") continue;
      expect(departments[need].permissions, key).toContain("director");
    }
    expect(mayChangeDepartment(["director"], "casting")).toBe(false);
  });

  it.each([
    "POST /api/productions/{productionId}/items/{itemId}/props",
    "PUT /api/productions/{productionId}/props/{propId}",
    "DELETE /api/productions/{productionId}/props/{propId}",
    "PUT /api/productions/{productionId}/items/{itemId}/props-notes",
  ])("has %s need Stage or Director", (key) => {
    expect(needOf(key)).toBe("props");
  });

  it("leaves reading props notes open to everyone", () => {
    expect(routeKeys).toContain("GET /api/productions/{productionId}/props-notes");
    expect(needOf("GET /api/productions/{productionId}/props-notes")).toBeUndefined();
  });

  it("has saving scenery notes need Stage, Tech or Director, and reading them need nothing", () => {
    expect(needOf("PUT /api/productions/{productionId}/items/{itemId}/scenery-notes")).toBe(
      "scenery",
    );
    expect(needOf("GET /api/productions/{productionId}/scenery-notes")).toBeUndefined();
  });

  it("has deleting a scenery file need Stage, Tech or Director", () => {
    expect(needOf("DELETE /api/productions/{productionId}/items/{itemId}/scenery-files")).toBe(
      "scenery",
    );
  });

  it("has uploading a scenery file need Stage, Tech or Director", () => {
    expect(needOf("POST /api/productions/{productionId}/items/{itemId}/scenery-uploads")).toBe(
      "scenery",
    );
  });

  it.each([
    "GET /api/productions/{productionId}/items/{itemId}/scenery-files",
    "GET /api/productions/{productionId}/items/{itemId}/scenery-file-link",
    "GET /api/productions/{productionId}/scenery-file-counts",
  ] as const)("leaves %s open to everyone", (key) => {
    expect(routeKeys).toContain(key);
    expect(needOf(key)).toBeUndefined();
  });

  it.each([
    "DELETE /api/productions/{productionId}/items/{itemId}/sfx-files",
    "POST /api/productions/{productionId}/items/{itemId}/sfx-uploads",
    "PUT /api/productions/{productionId}/items/{itemId}/sfx-notes",
  ] as const)("has %s need Tech or Director, and refuse others naming the SFX", (key) => {
    expect(needOf(key)).toBe("sfx");
  });

  it.each([
    "GET /api/productions/{productionId}/items/{itemId}/sfx-files",
    "GET /api/productions/{productionId}/items/{itemId}/sfx-file-link",
    "GET /api/productions/{productionId}/sfx-notes",
    "GET /api/productions/{productionId}/sfx-file-counts",
  ] as const)("leaves %s open to everyone", (key) => {
    expect(routeKeys).toContain(key);
    expect(needOf(key)).toBeUndefined();
  });

  it.each([
    "DELETE /api/productions/{productionId}/items/{itemId}/wardrobe-files",
    "POST /api/productions/{productionId}/items/{itemId}/wardrobe-uploads",
    "PUT /api/productions/{productionId}/items/{itemId}/wardrobe-notes",
  ] as const)("has %s need Wardrobe or Director, and refuse others naming the wardrobe", (key) => {
    expect(needOf(key)).toBe("wardrobe");
  });

  it.each([
    "GET /api/productions/{productionId}/items/{itemId}/wardrobe-files",
    "GET /api/productions/{productionId}/items/{itemId}/wardrobe-file-link",
    "GET /api/productions/{productionId}/wardrobe-notes",
    "GET /api/productions/{productionId}/wardrobe-file-counts",
  ] as const)("leaves %s open to everyone", (key) => {
    expect(routeKeys).toContain(key);
    expect(needOf(key)).toBeUndefined();
  });

  it.each([
    "PUT /api/productions/{productionId}/items/{itemId}/mic-plot",
    "PUT /api/productions/{productionId}/items/{itemId}/mic-plot-notes",
  ] as const)("has %s need Tech or Director, and refuse others naming the mic plot", (key) => {
    expect(needOf(key)).toBe("mic-plot");
  });

  it.each([
    "GET /api/productions/{productionId}/mic-plot",
    "GET /api/productions/{productionId}/mic-plot-notes",
  ] as const)("leaves %s open to everyone signed in to read", (key) => {
    expect(routeKeys).toContain(key);
    expect(needOf(key)).toBeUndefined();
  });

  it("has every other change route today need Casting, or stay admin-only", () => {
    const changes = routeKeys.filter(
      (key) =>
        !readOnlyMayUse(key) &&
        !["props", "scenery", "sfx", "mic-plot", "wardrobe"].includes(needOf(key) ?? ""),
    );
    const needsCasting = (key: string) => needOf(key) === "casting";
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

describe("isChangeWithinProduction", () => {
  const changes = routeKeys.filter(isChangeWithinProduction);

  it("takes in every route that changes something in a production", () => {
    expect(changes.length).toBeGreaterThan(20);
    for (const key of routeKeys.filter((route) => !isReadRoute(route))) {
      if (key.includes("/{productionId}/")) expect(changes, key).toContain(key);
    }
  });

  it.each([
    "GET /api/productions/{productionId}/cast",
    "POST /api/productions/{productionId}/casting-grid/export",
    "POST /api/productions",
    "DELETE /api/productions/{productionId}",
    "POST /api/usage",
    "POST /api/accounts",
  ])("leaves out %s, which changes nothing within a production", (key) => {
    expect(isChangeWithinProduction(key)).toBe(false);
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

describe("mayChangeDepartment", () => {
  it.each([
    ["casting", ["casting"]],
    ["props", ["stage", "director"]],
    ["scenery", ["stage", "tech", "director"]],
    ["sfx", ["tech", "director"]],
    ["mic-plot", ["tech", "director"]],
    ["wardrobe", ["wardrobe", "director"]],
  ] as const)("lets an admin, or %s's permissions %j alone, change it", (id, allowed) => {
    const mayEach = (["casting", "stage", "tech", "wardrobe", "director"] as const).filter(
      (permission) => mayChangeDepartment([permission], id),
    );

    expect(mayEach).toEqual(allowed);
    expect([mayChangeDepartment("admin", id), mayChangeDepartment([], id)]).toEqual([true, false]);
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

describe("readOnlyRefusal", () => {
  it.each([
    ["casting", "You can view the casting, but not change it."],
    ["props", "You can view the props, but not change them."],
    ["scenery", "You can view the scenery, but not change it."],
    ["sfx", "You can view the SFX, but not change them."],
    ["mic-plot", "You can view the mic plot, but not change it."],
    ["wardrobe", "You can view the wardrobe, but not change it."],
  ] as const)("says the %s can be viewed but not changed, naming the department", (id, line) => {
    expect(readOnlyRefusal(id)).toEqual({ message: line, department: id });
  });

  it("names the scenery, not the props, though Stage, whose own department is the props, is listed first", () => {
    expect(departments.scenery.permissions[0]).toBe("stage");
    expect(departments.props.permissions).toContain("stage");
    const key = "PUT /api/productions/{productionId}/items/{itemId}/scenery-notes";
    const need = needOf(key);

    expect(need).toBe("scenery");
    expect(readOnlyRefusal("scenery").message).toBe("You can view the scenery, but not change it.");
  });
});

describe("isRefusalAsReadOnly", () => {
  it("recognises every department's refusal", () => {
    expect(departmentIds.every((id) => isRefusalAsReadOnly(readOnlyRefusal(id)))).toBe(true);
  });

  it("recognises a refusal by its department, however it is worded", () => {
    expect(isRefusalAsReadOnly({ message: "Reworded.", department: "sfx" })).toBe(true);
  });

  it.each([
    [{ message: "You can view the SFX, but not change them." }],
    [{ message: "Only admins can do this." }],
    [{ message: "No.", department: "stage" }],
    ["You can view the casting, but not change it."],
    [undefined],
  ])("doesn't take %j for a read-only refusal", (body) => {
    expect(isRefusalAsReadOnly(body)).toBe(false);
  });
});
