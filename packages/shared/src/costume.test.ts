import { describe, expect, it } from "vitest";
import { Costume, CostumeList, isEmptyCostume, SaveCostumeRequest } from "./costume.ts";

// Made-up: Alex Morgan (1) as Captain Hook (7) in Opening Number.
const hook = {
  itemId: "opening-number",
  roleId: 7,
  castMemberId: 1,
  fromWardrobe: "Red coat, hook",
  fromCastMember: "Black shoes",
  notes: "Hem the coat",
};

describe("Costume", () => {
  it("is what one cast member wears in one role in an item", () => {
    expect(Costume.parse(hook)).toEqual(hook);
  });

  it("refuses fields it doesn't keep, so it can't carry anything else about a person", () => {
    expect(Costume.safeParse({ ...hook, size: "Age 10" }).success).toBe(false);
  });
});

describe("CostumeList", () => {
  it("is a production's costumes", () => {
    expect(CostumeList.parse({ productionId: "2027", costumes: [hook] })).toEqual({
      productionId: "2027",
      costumes: [hook],
    });
  });
});

describe("SaveCostumeRequest", () => {
  const { itemId: _itemId, ...request } = hook;

  it("trims each field, and allows them empty", () => {
    expect(
      SaveCostumeRequest.parse({ ...request, fromWardrobe: "  Red coat  ", notes: "" }),
    ).toEqual({ ...request, fromWardrobe: "Red coat", notes: "" });
  });

  it.each(["fromWardrobe", "fromCastMember", "notes"])(
    "allows up to 500 characters in %s",
    (field) => {
      expect(SaveCostumeRequest.safeParse({ ...request, [field]: "x".repeat(500) }).success).toBe(
        true,
      );
      expect(SaveCostumeRequest.safeParse({ ...request, [field]: "x".repeat(501) }).success).toBe(
        false,
      );
    },
  );

  it("allows 500 characters with spaces round them, counted once trimmed", () => {
    const padded = ` ${"x".repeat(500)} `;

    expect(SaveCostumeRequest.parse({ ...request, notes: padded }).notes).toBe("x".repeat(500));
  });

  it("refuses an item in the body: it comes from the path", () => {
    expect(SaveCostumeRequest.safeParse(hook).success).toBe(false);
  });
});

describe("isEmptyCostume", () => {
  it("is true only when all three fields are empty", () => {
    const blank = { fromWardrobe: "", fromCastMember: "", notes: "" };
    expect(isEmptyCostume(blank)).toBe(true);
    expect(isEmptyCostume({ ...blank, notes: "Hem" })).toBe(false);
  });
});
