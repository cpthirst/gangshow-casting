import { isAccountRoute, routeKeys } from "@app/shared";
import { describe, expect, it } from "vitest";
import { routes } from "./routes.ts";

describe("the routes table", () => {
  it("has a handler for exactly the shared route list's routes, but for the account routes", () => {
    const dataKeys = routeKeys.filter((key) => !isAccountRoute(key));

    expect(Object.keys(routes).sort()).toEqual(dataKeys.sort());
  });
});
