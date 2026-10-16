import { describe, expect, it } from "vitest";
import { AddRoleRequest, Role, RoleList } from "./role.ts";

const captainHook = {
  id: 1,
  itemId: "pirate-sketch",
  name: "Captain Hook",
  size: "lead",
  castMemberIds: [],
  revision: 1,
};

describe("Role", () => {
  it("accepts an uncast role", () => {
    expect(Role.parse(captainHook)).toEqual(captainHook);
  });

  it.each(["lead", "support", "cameo", "ensemble"])("accepts the role size %s", (size) => {
    expect(Role.safeParse({ ...captainHook, size }).success).toBe(true);
  });

  it.each([
    ["an empty name", { name: "   " }],
    ["a name over 60 characters", { name: "x".repeat(61) }],
    ["a size outside the list", { size: "star" }],
    ["no item", { itemId: "" }],
  ])("rejects %s", (_case, change) => {
    expect(Role.safeParse({ ...captainHook, ...change }).success).toBe(false);
  });

  // Roles hold cast member ids, never names, so deleting someone removes them everywhere.
  it("refuses any other field, such as a copied name", () => {
    expect(Role.safeParse({ ...captainHook, castNames: ["Sam Example"] }).success).toBe(false);
  });
});

describe("AddRoleRequest", () => {
  it("takes a name and size, trimming the name", () => {
    expect(AddRoleRequest.parse({ name: "  Captain Hook ", size: "lead" })).toEqual({
      name: "Captain Hook",
      size: "lead",
    });
  });

  it("refuses an id, which the app assigns", () => {
    expect(AddRoleRequest.safeParse({ id: 9, name: "Captain Hook", size: "lead" }).success).toBe(
      false,
    );
  });
});

describe("RoleList", () => {
  it("accepts a production's roles", () => {
    expect(RoleList.parse({ productionId: "2027", roles: [captainHook] }).roles).toHaveLength(1);
  });
});
