import { describe, expect, it } from "vitest";
import {
  alexMorgan,
  aRole,
  captainHook,
  joBrown,
  pirateCast,
  pirates,
  smee,
} from "./casting.fixture.ts";
import { alexAsHook } from "./costumes.fixture.ts";
import { costumeErrors, costumeOf, costumeRowsOf, rowName, withSaved } from "./costumes.ts";

const named = (rows: ReturnType<typeof costumeRowsOf>) =>
  rows.map(({ role, member }) => [
    role.name,
    member ? `${member.firstName} ${member.lastName}` : null,
  ]);

describe("costumeRowsOf", () => {
  it("gives a row per cast member per role, roles in the item's role order and each role's cast as the casting item page shows them", () => {
    // Given the ensemble first, its cast out of surname order, and a role in another item
    const roles = [pirates, captainHook(), aRole(9, "finale", [alexMorgan.id])];

    // When the Opening Number's rows are listed
    const rows = costumeRowsOf(roles, pirateCast, "opening-number");

    // Then the lead comes first, then the ensemble by surname, and nothing from the Finale
    expect(named(rows)).toEqual([
      ["Captain Hook", "Alex Morgan"],
      ["Pirates", "Jo Brown"],
      ["Pirates", "Kim Lee"],
      ["Pirates", "Sam Patel"],
    ]);
  });

  it("gives an uncast role one row with nobody in it", () => {
    expect(named(costumeRowsOf([smee], pirateCast, "opening-number"))).toEqual([["Smee", null]]);
  });

  it("treats a role whose only cast member has left the cast list as uncast", () => {
    const roles = [aRole(9, "opening-number", [99], { name: "Smee", size: "support" })];

    expect(named(costumeRowsOf(roles, pirateCast, "opening-number"))).toEqual([["Smee", null]]);
  });

  it("gives no rows for an item with no roles", () => {
    expect(costumeRowsOf([captainHook()], pirateCast, "interval-music")).toEqual([]);
  });
});

// Made-up: Jo Brown as a Pirate, beside Alex Morgan as Captain Hook.
const joAsPirate = {
  ...alexAsHook,
  roleId: pirates.id,
  castMemberId: joBrown.id,
  fromWardrobe: "Striped top",
};

describe("costumeOf", () => {
  it("gives the row's saved fields", () => {
    expect(costumeOf([joAsPirate, alexAsHook], captainHook(), alexMorgan)).toEqual(alexAsHook);
  });

  it("gives empty fields at revision 0 for a row nobody has saved", () => {
    expect(costumeOf([joAsPirate], captainHook(), alexMorgan)).toEqual({
      fromWardrobe: "",
      fromCastMember: "",
      notes: "",
      revision: 0,
    });
  });
});

describe("withSaved", () => {
  it("replaces the row's costume, keeping the others", () => {
    const saved = { ...alexAsHook, fromWardrobe: "Blue coat" };

    expect(withSaved([alexAsHook, joAsPirate], saved)).toEqual([joAsPirate, saved]);
  });
});

describe("costumeErrors", () => {
  it("says which fields are over 500 characters, by their labels", () => {
    const fields = { fromWardrobe: "x".repeat(501), fromCastMember: "x".repeat(500), notes: "" };

    expect(costumeErrors(fields)).toEqual({
      fromWardrobe: "From Wardrobe can be up to 500 characters.",
    });
  });

  it("counts a field as it will be saved, without the spaces round it", () => {
    expect(
      costumeErrors({ fromWardrobe: ` ${"x".repeat(500)} `, fromCastMember: "", notes: "" }),
    ).toEqual({});
  });
});

describe("rowName", () => {
  it("names the cast member, then the role", () => {
    expect(rowName(captainHook(), alexMorgan)).toBe("Alex Morgan as Captain Hook");
  });
});
