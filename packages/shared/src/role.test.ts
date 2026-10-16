import { describe, expect, it } from "vitest";
import {
  AddRoleRefusal,
  AddRoleRequest,
  Role,
  RoleList,
  sameRoleName,
  UpdateRoleRequest,
} from "./role.ts";

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
  it("takes a name and size, trimming the name, with nobody cast by default", () => {
    expect(AddRoleRequest.parse({ name: "  Captain Hook ", size: "lead" })).toEqual({
      name: "Captain Hook",
      size: "lead",
      castMemberIds: [],
    });
  });

  it.each(["lead", "support", "cameo"])("lets a %s role have one cast member", (size) => {
    const request = { name: "Captain Hook", size, castMemberIds: [12] };
    expect(AddRoleRequest.parse(request).castMemberIds).toEqual([12]);
  });

  it.each(["lead", "support", "cameo"])("refuses a %s role with two cast members", (size) => {
    const request = { name: "Captain Hook", size, castMemberIds: [12, 13] };
    expect(AddRoleRequest.safeParse(request).success).toBe(false);
  });

  it("lets an ensemble have several cast members", () => {
    const request = { name: "Pirates", size: "ensemble", castMemberIds: [12, 13] };
    expect(AddRoleRequest.parse(request).castMemberIds).toEqual([12, 13]);
  });

  it("refuses the same cast member twice in a role", () => {
    const request = { name: "Pirates", size: "ensemble", castMemberIds: [12, 12] };
    expect(AddRoleRequest.safeParse(request).success).toBe(false);
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

describe("sameRoleName", () => {
  it.each([
    ["Captain Hook", "Captain Hook"],
    ["Captain Hook", "captain hook"],
    ["Captain Hook", "  CAPTAIN HOOK "],
  ])("treats %j and %j as the same name", (a, b) => {
    expect(sameRoleName(a, b)).toBe(true);
  });

  it("tells different names apart", () => {
    expect(sameRoleName("Captain Hook", "Captain Cook")).toBe(false);
  });
});

describe("AddRoleRefusal", () => {
  it("says the name is already taken in the item", () => {
    expect(AddRoleRefusal.parse({ error: "name-taken" })).toEqual({ error: "name-taken" });
  });
});

describe("UpdateRoleRequest", () => {
  const edit = { name: "Mr Smee", size: "lead", castMemberIds: [12], revision: 2 };

  it("takes new details and the revision they were based on", () => {
    expect(UpdateRoleRequest.parse(edit)).toEqual(edit);
  });

  it.each([
    ["no revision", { ...edit, revision: undefined }],
    ["an empty name", { ...edit, name: " " }],
    ["two people in a lead role", { ...edit, castMemberIds: [12, 13] }],
    ["the same person twice", { ...edit, size: "ensemble", castMemberIds: [12, 12] }],
    ["an id, which comes from the URL", { ...edit, id: 7 }],
  ])("refuses %s", (_case, request) => {
    expect(UpdateRoleRequest.safeParse(request).success).toBe(false);
  });
});
