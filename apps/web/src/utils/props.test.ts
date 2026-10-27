import type { CastMember, Role } from "@app/shared";
import { describe, expect, it } from "vitest";
import {
  carriersHint,
  carriersOf,
  carryingOf,
  type PropFormFields,
  propCountLabel,
  propCounts,
  propDetailsFrom,
  propsListOf,
  rolesOf,
  sortProps,
} from "./props.ts";
import { anItem, aRunningOrder } from "./running-order.fixture.ts";

const aProp = (id: number, itemId: string, roleIds: number[] = [], quantity = 1) => ({
  id,
  itemId,
  name: `Prop ${id}`,
  quantity,
  roleIds,
  carrierIds: [],
});

const aRole = (id: number, name: string, size: Role["size"]): Role => ({
  id,
  itemId: "pirate-sketch",
  name,
  size,
  castMemberIds: [],
  revision: 1,
});

/** The prop form as typed: a name, a quantity of 1, and no roles unless given. */
const fields = (name: string, more: Partial<PropFormFields> = {}): PropFormFields => ({
  name,
  quantity: "1",
  role: { query: "", id: null },
  roleIds: [],
  carrier: { query: "", id: null },
  carrierIds: [],
  ...more,
});

describe("propCounts", () => {
  it("counts each item's props, by item id, with none for an item without props", () => {
    const counts = propCounts([
      aProp(1, "pirate-sketch"),
      aProp(2, "finale"),
      aProp(3, "pirate-sketch"),
    ]);

    expect(counts("pirate-sketch")).toBe(2);
    expect(counts("finale")).toBe(1);
    expect(counts("opening-number")).toBe(0);
  });

  it("adds up each item's quantities", () => {
    const counts = propCounts([aProp(1, "village-square", [], 10), aProp(2, "village-square")]);

    expect(counts("village-square")).toBe(11);
  });
});

describe("propCountLabel", () => {
  it.each([
    [0, "0 props"],
    [1, "1 prop"],
    [3, "3 props"],
  ])("labels %i as %s", (count, label) => {
    expect(propCountLabel(count)).toBe(label);
  });
});

describe("sortProps", () => {
  it("orders props by name, ignoring case and comparing numbers by value", () => {
    const props = [
      {
        id: 1,
        itemId: "pirate-sketch",
        name: "umbrella 10",
        quantity: 1,
        roleIds: [],
        carrierIds: [],
      },
      {
        id: 2,
        itemId: "pirate-sketch",
        name: "Treasure chest",
        quantity: 1,
        roleIds: [],
        carrierIds: [],
      },
      {
        id: 3,
        itemId: "pirate-sketch",
        name: "Umbrella 2",
        quantity: 1,
        roleIds: [],
        carrierIds: [],
      },
    ];

    expect(sortProps(props).map((prop) => prop.name)).toEqual([
      "Treasure chest",
      "Umbrella 2",
      "umbrella 10",
    ]);
  });
});

describe("propDetailsFrom", () => {
  // What the prop's roles leave: everyone carries it, or carriers are chosen; no named parts.
  const fits = { offersCarriers: false, named: 0, namedRoles: [] };
  const choosing = { offersCarriers: true, named: 0, namedRoles: [] };

  it("gives the prop's name, trimmed", () => {
    expect(propDetailsFrom(fields(" Parrot "), fits)).toEqual({
      ok: true,
      details: { name: "Parrot", quantity: 1, roleIds: [], carrierIds: [] },
    });
  });

  it("gives the quantity typed", () => {
    expect(propDetailsFrom(fields("Umbrella", { quantity: " 10 " }), fits)).toEqual({
      ok: true,
      details: { name: "Umbrella", quantity: 10, roleIds: [], carrierIds: [] },
    });
  });

  it.each(["0", "100", "2.5", "-1", "", " ", "1e1", "ten"])(
    "says the quantity must be a whole number from 1 to 99 when it's %j",
    (quantity) => {
      expect(propDetailsFrom(fields("Umbrella", { quantity }), fits)).toEqual({
        ok: false,
        errors: { quantity: "Quantity must be a whole number from 1 to 99" },
      });
    },
  );

  it("says what's wrong with the name and the quantity together", () => {
    expect(propDetailsFrom(fields("", { quantity: "0" }), fits)).toEqual({
      ok: false,
      errors: {
        name: "A prop needs a name",
        quantity: "Quantity must be a whole number from 1 to 99",
      },
    });
  });

  it("gives the roles picked", () => {
    expect(propDetailsFrom(fields("Telescope", { roleIds: [3, 1] }), fits)).toEqual({
      ok: true,
      details: { name: "Telescope", quantity: 1, roleIds: [3, 1], carrierIds: [] },
    });
  });

  it("gives the carriers chosen while carriers are offered", () => {
    const basket = fields("Bread basket", { roleIds: [6], carrierIds: [4] });
    expect(propDetailsFrom(basket, choosing)).toEqual({
      ok: true,
      details: { name: "Bread basket", quantity: 1, roleIds: [6], carrierIds: [4] },
    });
  });

  it("gives no carriers when everyone in the prop's roles carries it", () => {
    const telescope = fields("Telescope", { roleIds: [1], carrierIds: [4] });
    expect(propDetailsFrom(telescope, fits)).toMatchObject({ details: { carrierIds: [] } });
  });

  it("says a carrier typed but not chosen from the list must be chosen or cleared", () => {
    const basket = fields("Bread basket", { carrier: { query: "kim", id: null } });
    expect(propDetailsFrom(basket, choosing)).toEqual({
      ok: false,
      errors: { carrier: "Choose someone from the list, or clear the field" },
    });
    expect(propDetailsFrom(basket, fits).ok).toBe(true);
  });

  it("says to remove carriers before lowering the quantity below the carriers", () => {
    const lantern = fields("Lantern", { quantity: "2", carrierIds: [3, 4, 7] });
    expect(propDetailsFrom(lantern, choosing)).toEqual({
      ok: false,
      errors: { quantity: "3 carriers chosen for 2: remove 1 from Selected carriers first" },
    });
  });

  it("says the quantity must cover the prop's named parts", () => {
    const whistle = fields("Whistle", { quantity: "2", roleIds: [1, 2, 3] });
    const named = ["Captain Cross", "Captain Nought", "Referee"];
    expect(
      propDetailsFrom(whistle, { offersCarriers: false, named: 3, namedRoles: named }),
    ).toEqual({
      ok: false,
      errors: {
        quantity:
          "Captain Cross, Captain Nought and Referee always carry it: make the quantity at least 3",
      },
    });
  });

  it("counts only the room the named parts leave when saying how many carriers to remove", () => {
    const lantern = fields("Lantern", { quantity: "2", carrierIds: [3, 4] });
    expect(
      propDetailsFrom(lantern, { offersCarriers: true, named: 1, namedRoles: ["Baker"] }),
    ).toEqual({
      ok: false,
      errors: { quantity: "2 carriers chosen for 1: remove 1 from Selected carriers first" },
    });
  });

  it("says a role typed but not chosen from the list must be chosen or cleared", () => {
    expect(
      propDetailsFrom(fields("Telescope", { role: { query: "capt", id: null } }), fits),
    ).toEqual({
      ok: false,
      errors: { role: "Choose a role from the list, or clear the field" },
    });
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
  ])("says a prop needs a name when it's %s", (_case, name) => {
    expect(propDetailsFrom(fields(name), fits)).toEqual({
      ok: false,
      errors: { name: "A prop needs a name" },
    });
  });

  it("says how long a prop's name can be", () => {
    expect(propDetailsFrom(fields("x".repeat(81)), fits)).toEqual({
      ok: false,
      errors: { name: "Prop names can be up to 80 characters" },
    });
  });
});

describe("rolesOf", () => {
  const captain = aRole(1, "Captain", "lead");
  const pirate1 = aRole(2, "Pirate 1", "support");

  it("gives the prop's roles in the item's role order, leads first", () => {
    expect(
      rolesOf(aProp(1, "pirate-sketch", [pirate1.id, captain.id]), [pirate1, captain]),
    ).toEqual([captain, pirate1]);
  });

  it("leaves out a role that's been removed", () => {
    expect(rolesOf(aProp(1, "pirate-sketch", [captain.id, pirate1.id]), [pirate1])).toEqual([
      pirate1,
    ]);
  });
});

describe("who carries a prop", () => {
  // Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
  const member = (id: number, firstName: string, lastName: string): CastMember => ({
    id,
    firstName,
    lastName,
    section: null,
    group: "",
    singing: "",
    acting: "",
    revision: 1,
  });
  const sam = member(1, "Sam", "Taylor");
  const jo = member(3, "Jo", "Brown");
  const kim = member(4, "Kim", "Lee");
  const alex = member(5, "Alex", "Green");
  const villageCast = [sam, jo, kim, alex];
  const playedBy = (role: Role, ...members: CastMember[]): Role => ({
    ...role,
    castMemberIds: members.map(({ id }) => id),
  });
  const villagers = playedBy(aRole(6, "Villagers", "ensemble"), jo, kim, alex);
  const baker = playedBy(aRole(7, "Baker", "lead"), sam);

  describe("carriersOf", () => {
    it("gives the named parts, and the ensembles' cast to choose from once each, by surname", () => {
      const crowd = playedBy(aRole(8, "Crowd", "ensemble"), kim, sam);
      const lanterns = carriersOf([villagers, baker, crowd], villageCast, 3);
      expect(lanterns.named).toEqual([sam]);
      expect(lanterns.choosable).toEqual([jo, alex, kim]);
      expect(lanterns.room).toBe(2);
      expect(lanterns.offersCarriers).toBe(true);
    });

    it("offers no choosing, and the ensemble doesn't carry it, when the named parts fill it", () => {
      const lantern = carriersOf([villagers, baker], villageCast, 1);
      expect(lantern.room).toBe(0);
      expect(lantern.offersCarriers).toBe(false);
      expect(lantern.everyoneFits).toBe(false);
    });

    it("offers no choosing when the ensembles fit the room the named parts leave", () => {
      expect(carriersOf([villagers, baker], villageCast, 4).offersCarriers).toBe(false);
    });

    it("leaves no room, and offers no choosing, when the named parts outnumber the quantity", () => {
      const mayor = playedBy(aRole(9, "Mayor", "cameo"), jo);
      const whistle = carriersOf([baker, mayor], villageCast, 1);
      expect(whistle.room).toBe(0);
      expect(whistle.offersCarriers).toBe(false);
    });
  });

  describe("carryingOf", () => {
    const carried = (quantity: number, roleIds: number[], carrierIds: number[] = []) =>
      carryingOf(
        { ...aProp(1, "village-square", roleIds, quantity), carrierIds },
        [villagers, baker],
        villageCast,
      );
    const shown = (carrying: ReturnType<typeof carryingOf>) =>
      carrying.roles.map(({ role, carriers, none }) => [role.name, carriers || none]);

    it("names everyone in the roles when they fit the quantity, with none to choose", () => {
      const umbrellas = carried(10, [villagers.id]);
      expect(shown(umbrellas)).toEqual([["Villagers", "Jo Brown, Alex Green, Kim Lee"]]);
      expect(umbrellas.toChoose).toBe(0);
    });

    it("names only the carriers, role by role, when there are more people than the quantity", () => {
      const lanterns = carried(2, [villagers.id, baker.id], [jo.id, sam.id]);
      expect(shown(lanterns)).toEqual([
        ["Baker", "Sam Taylor"],
        ["Villagers", "Jo Brown"],
      ]);
      expect(lanterns.toChoose).toBe(0);
    });

    it("says how many are left to choose once the named parts have theirs", () => {
      expect(carried(3, [villagers.id, baker.id], [jo.id]).toChoose).toBe(1);
      expect(carried(3, [villagers.id, baker.id]).toChoose).toBe(2);
    });

    it("always names the named parts, choosing only from the ensembles", () => {
      const lantern = carried(2, [villagers.id, baker.id]);
      expect(shown(lantern)).toEqual([
        ["Baker", "Sam Taylor"],
        ["Villagers", "Nobody carries it"],
      ]);
      expect(lantern.toChoose).toBe(1);
    });

    it("names no ensemble carrier saved before the named parts filled the quantity", () => {
      const lantern = carried(1, [villagers.id, baker.id], [jo.id]);
      expect(shown(lantern)).toEqual([
        ["Baker", "Sam Taylor"],
        ["Villagers", "Nobody carries it"],
      ]);
    });

    it("says how many aren't given to anyone when the carriers don't use the quantity", () => {
      expect(carried(10, [villagers.id]).notGiven).toBe(7);
      expect(carried(3, [baker.id]).notGiven).toBe(2);
      expect(carried(3, [villagers.id]).notGiven).toBe(0);
    });

    it("gives none as not given while carriers are still to choose, or with no roles", () => {
      expect(carried(2, [villagers.id]).notGiven).toBe(0);
      expect(carried(3, []).notGiven).toBe(0);
    });

    it("names the whole ensemble when it fits what the named parts leave", () => {
      const lanterns = carried(4, [villagers.id, baker.id]);
      expect(shown(lanterns)).toEqual([
        ["Baker", "Sam Taylor"],
        ["Villagers", "Jo Brown, Alex Green, Kim Lee"],
      ]);
      expect(lanterns.toChoose).toBe(0);
    });

    it("names every named part, with none to choose, even when they outnumber the quantity", () => {
      const mayor = { ...aRole(9, "Mayor", "cameo"), castMemberIds: [jo.id] };
      const whistle = carryingOf(
        aProp(1, "village-square", [baker.id, mayor.id], 1),
        [baker, mayor],
        villageCast,
      );
      expect(shown(whistle)).toEqual([
        ["Baker", "Sam Taylor"],
        ["Mayor", "Jo Brown"],
      ]);
      expect(whistle.toChoose).toBe(0);
    });

    it("says when nobody in a role carries the prop, and marks an uncast role as uncast", () => {
      const lantern = carryingOf(
        { ...aProp(1, "village-square", [villagers.id, baker.id, 9], 1), carrierIds: [sam.id] },
        [villagers, baker, aRole(9, "Dog", "cameo")],
        villageCast,
      );
      expect(shown(lantern)).toEqual([
        ["Baker", "Sam Taylor"],
        ["Dog", "Uncast"],
        ["Villagers", "Nobody carries it"],
      ]);
    });
  });

  describe("carriersHint", () => {
    it.each([
      [1, 0, "Choose up to 1"],
      [3, 1, "Choose up to 3 · 2 left to choose"],
      [2, 2, "Choose up to 2 · none left to choose"],
      // After the quantity is lowered below the carriers already chosen.
      [1, 2, "Choose up to 1 · 1 too many: remove 1"],
      [2, 5, "Choose up to 2 · 3 too many: remove 3"],
    ])("with a quantity of %s and %s chosen, says %j", (quantity, chosen, hint) => {
      expect(carriersHint(quantity, chosen)).toBe(hint);
    });
  });
});

describe("the props list, for the Word document", () => {
  // Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
  const member = (id: number, firstName: string, lastName: string): CastMember => ({
    id,
    firstName,
    lastName,
    section: "scouts",
    group: "1st Made-up",
    singing: "Strong alto voice",
    acting: "",
    revision: 1,
  });
  const sam = member(1, "Sam", "Taylor");
  const jo = member(2, "Jo", "Brown");
  const role = (id: number, name: string, size: Role["size"], castMemberIds: number[] = []) => ({
    ...aRole(id, name, size),
    castMemberIds,
  });
  const order = aRunningOrder(
    [anItem("Pirate Sketch"), anItem("Interval Announcement", { printed: false })],
    [anItem("Finale")],
  );
  const roles = [
    role(1, "Pirate 2", "ensemble"),
    role(2, "Captain", "lead", [sam.id]),
    role(3, "Pirate 1", "ensemble", [jo.id]),
  ];
  const prop = (id: number, name: string, roleIds: number[] = []) => ({
    ...aProp(id, "pirate-sketch", roleIds),
    name,
  });

  const list = () =>
    propsListOf({
      order,
      props: [prop(1, "Umbrella 10"), prop(2, "telescope", [2]), prop(3, "Umbrella 2", [1, 3])],
      roles,
      cast: [sam, jo],
      notes: [
        { itemId: "pirate-sketch", text: "Chest set stage left", revision: 1 },
        { itemId: "finale", text: "", revision: 2 },
      ],
    });

  it("follows the running order, half by half, numbering only printed items", () => {
    expect(
      list().map(({ name, items }) => [name, items.map(({ number, title }) => [number, title])]),
    ).toEqual([
      [
        "First half",
        [
          [1, "Pirate Sketch"],
          [null, "Interval Announcement"],
        ],
      ],
      ["Second half", [[1, "Finale"]]],
    ]);
  });

  it("puts the props in name order, numbers by value, each with its roles in role order and who plays them", () => {
    const sketch = list()[0]?.items[0];

    expect(sketch?.props).toEqual([
      { name: "telescope", roles: [{ name: "Captain", cast: "Sam Taylor" }] },
      {
        name: "Umbrella 2",
        roles: [
          { name: "Pirate 1", cast: "Jo Brown" },
          { name: "Pirate 2", cast: "" },
        ],
      },
      { name: "Umbrella 10", roles: [] },
    ]);
  });

  it("gives each item its props notes, and none once they're cleared", () => {
    const items = list().flatMap((half) => half.items);

    expect(items.map(({ notes }) => notes)).toEqual(["Chest set stage left", "", ""]);
  });
});
