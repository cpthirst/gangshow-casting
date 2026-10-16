import { RoleList } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createGetRoles } from "./get-roles.ts";
import { inMemoryRoleStore } from "./role-store.ts";

describe("get roles handler", () => {
  it("returns 200 with every role in the production", async () => {
    const store = inMemoryRoleStore();
    await store.add("2027", "itm_pirate-sketch", { name: "Captain Hook", size: "lead" });

    const res = await createGetRoles(store)({ pathParameters: { productionId: "2027" } });

    expect(res.statusCode).toBe(200);
    expect(RoleList.parse(JSON.parse(res.body ?? "")).roles.map((r) => r.name)).toEqual([
      "Captain Hook",
    ]);
  });

  it("returns an empty list before any roles are added", async () => {
    const res = await createGetRoles(inMemoryRoleStore())({
      pathParameters: { productionId: "2027" },
    });

    expect(JSON.parse(res.body ?? "")).toEqual({ productionId: "2027", roles: [] });
  });

  it("returns 404 for an invalid production id", async () => {
    const res = await createGetRoles(inMemoryRoleStore())({
      pathParameters: { productionId: "../etc" },
    });

    expect(res.statusCode).toBe(404);
  });
});
