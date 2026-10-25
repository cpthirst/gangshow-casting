import { describe, expect, it } from "vitest";
import { Prop, PropList } from "./prop.ts";

const aProp = (id: number, itemId: string, name = `Prop ${id}`) => ({ id, itemId, name });

describe("Prop", () => {
  it("is a named prop in one item", () => {
    const prop = aProp(1, "pirate-sketch", "Treasure chest");
    expect(Prop.parse(prop)).toEqual(prop);
  });

  it("refuses unknown fields, so it can't carry cast data", () => {
    expect(Prop.safeParse({ ...aProp(1, "pirate-sketch"), castMemberIds: [1] }).success).toBe(
      false,
    );
  });

  it("needs a name", () => {
    expect(Prop.safeParse(aProp(1, "pirate-sketch", "  ")).success).toBe(false);
  });
});

describe("PropList", () => {
  it("is a production's props", () => {
    expect(PropList.parse({ productionId: "2027", props: [] })).toEqual({
      productionId: "2027",
      props: [],
    });
  });
});
