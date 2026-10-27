import { describe, expect, it } from "vitest";
import {
  AddPropRequest,
  carryingCast,
  MAX_PROP_NAME_LENGTH,
  MAX_PROP_QUANTITY,
  Prop,
  PropList,
} from "./prop.ts";

const aProp = (id: number, itemId: string, name = `Prop ${id}`) => ({
  id,
  itemId,
  name,
  quantity: 1,
  roleIds: [],
  carrierIds: [],
});

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

  it("links to roles by id, never to cast members", () => {
    const prop = { ...aProp(1, "pirate-sketch", "Telescope"), roleIds: [3, 5] };
    expect(Prop.parse(prop)).toEqual(prop);
  });

  it("has no roles when it was saved before props had roles", () => {
    expect(Prop.parse({ id: 1, itemId: "pirate-sketch", name: "Telescope" }).roleIds).toEqual([]);
  });

  it("names its carriers by cast member id, and has none when saved before props had them", () => {
    const lanterns = { ...aProp(1, "village-square", "Lantern"), quantity: 2, carrierIds: [3, 4] };
    expect(Prop.parse(lanterns)).toEqual(lanterns);
    expect(Prop.parse({ id: 1, itemId: "village-square", name: "Lantern" }).carrierIds).toEqual([]);
  });

  it("has a quantity of 1 when it was saved before props had quantities", () => {
    expect(Prop.parse({ id: 1, itemId: "pirate-sketch", name: "Treasure chest" }).quantity).toBe(1);
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

describe("AddPropRequest", () => {
  it("is a prop's name, trimmed, with a quantity of 1 and no roles unless given", () => {
    expect(AddPropRequest.parse({ name: " Treasure chest " })).toEqual({
      name: "Treasure chest",
      quantity: 1,
      roleIds: [],
      carrierIds: [],
    });
  });

  it.each([1, 10, MAX_PROP_QUANTITY])("takes a quantity of %s", (quantity) => {
    expect(AddPropRequest.parse({ name: "Umbrella", quantity }).quantity).toBe(quantity);
  });

  it.each([0, MAX_PROP_QUANTITY + 1, 2.5, -1, "10"])("refuses a quantity of %s", (quantity) => {
    expect(AddPropRequest.safeParse({ name: "Umbrella", quantity }).success).toBe(false);
  });

  it("takes the ids of the roles that use the prop", () => {
    expect(AddPropRequest.parse({ name: "3 umbrellas", roleIds: [1, 2, 3] }).roleIds).toEqual([
      1, 2, 3,
    ]);
  });

  it("takes up to as many carriers as the quantity", () => {
    const basket = { name: "Bread basket", quantity: 2, roleIds: [1], carrierIds: [3, 4] };
    expect(AddPropRequest.parse(basket).carrierIds).toEqual([3, 4]);
  });

  it("refuses more carriers than the quantity", () => {
    const basket = { name: "Bread basket", quantity: 1, roleIds: [1], carrierIds: [3, 4] };
    expect(AddPropRequest.safeParse(basket).success).toBe(false);
  });

  it("refuses a carrier listed twice", () => {
    const basket = { name: "Bread basket", quantity: 2, roleIds: [1], carrierIds: [3, 3] };
    expect(AddPropRequest.safeParse(basket).success).toBe(false);
  });

  it("refuses a role listed twice", () => {
    expect(AddPropRequest.safeParse({ name: "Telescope", roleIds: [1, 1] }).success).toBe(false);
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
  ])("refuses a name that's %s", (_case, name) => {
    expect(AddPropRequest.safeParse({ name }).success).toBe(false);
  });

  it("refuses a name over the longest a prop's name can be", () => {
    expect(AddPropRequest.safeParse({ name: "x".repeat(MAX_PROP_NAME_LENGTH + 1) }).success).toBe(
      false,
    );
  });

  it("refuses the app-managed id and item, and unknown fields", () => {
    for (const extra of [{ id: 1 }, { itemId: "finale" }, { castMemberIds: [1] }]) {
      expect(AddPropRequest.safeParse({ name: "Parrot", ...extra }).success).toBe(false);
    }
  });
});

describe("carryingCast", () => {
  // Made-up ids: Sam (1) is the baker, Jo (3) and Kim (4) villagers, Ash (5) the mayor.
  const baker = { size: "lead" as const, castMemberIds: [1] };
  const mayor = { size: "cameo" as const, castMemberIds: [5] };
  const villagers = { size: "ensemble" as const, castMemberIds: [3, 4] };

  it("gives everyone in a named part as carrying it, and the ensembles' cast to choose from", () => {
    expect(carryingCast([baker, villagers, mayor])).toEqual({ named: [1, 5], choosable: [3, 4] });
  });

  it("counts someone in two named parts once, and never offers them from an ensemble", () => {
    const crowd = { size: "ensemble" as const, castMemberIds: [1, 4] };
    expect(carryingCast([baker, { ...mayor, castMemberIds: [1] }, crowd])).toEqual({
      named: [1],
      choosable: [4],
    });
  });

  it("offers each ensemble member once", () => {
    const crowd = { size: "ensemble" as const, castMemberIds: [4, 6] };
    expect(carryingCast([villagers, crowd]).choosable).toEqual([3, 4, 6]);
  });
});
