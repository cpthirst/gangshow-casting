import { describe, expect, it } from "vitest";
import { adminOnlyRouteKeys } from "./api-routes.ts";

describe("adminOnlyRouteKeys", () => {
  it("keeps only deleting a cast member and saving a running-order version for admins", () => {
    expect([...adminOnlyRouteKeys].sort()).toEqual([
      "DELETE /api/productions/{productionId}/cast/{castId}",
      "POST /api/productions/{productionId}/running-order/versions",
    ]);
  });
});
