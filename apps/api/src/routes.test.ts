import { routeKeys } from "@app/shared";
import { describe, expect, it } from "vitest";
import { routes } from "./routes.ts";

describe("the routes table", () => {
  it("has a handler for exactly the routes in the shared route list, which infra hosts", () => {
    expect(Object.keys(routes).sort()).toEqual([...routeKeys].sort());
  });
});
