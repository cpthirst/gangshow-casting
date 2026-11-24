import { describe, expect, it } from "vitest";
import {
  alexMorgan,
  aRole,
  captainHook,
  joBrown,
  kimLee,
  pirateCast,
  pirates,
  sailors,
  smee,
} from "./casting.fixture.ts";
import { alexAsHook } from "./costumes.fixture.ts";
import {
  costumeCopiesOf,
  costumeErrors,
  costumeOf,
  costumeRowsOf,
  rowName,
  withSaved,
} from "./costumes.ts";

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

describe("costumeCopiesOf", () => {
  const rows = costumeRowsOf([captainHook(), pirates, sailors, smee], pirateCast, "opening-number");
  /** The cast row of the member in the role. */
  const rowOf = (roleId: number, memberId: number) => {
    const row = rows.find(({ role, member }) => role.id === roleId && member?.id === memberId);
    if (!row?.member) throw new Error("no such row");
    return { role: row.role, member: row.member };
  };
  /** Each copy's label, question and whose rows it reaches. */
  const described = (copies: ReturnType<typeof costumeCopiesOf>) =>
    copies.map(({ label, question, to }) => ({
      label,
      question,
      to: to.map(({ role, member }) => rowName(role, member)),
    }));

  it("copies to every other cast row of the role's type, and to every other cast row", () => {
    expect(described(costumeCopiesOf(rows, rowOf(pirates.id, joBrown.id)))).toEqual([
      {
        label: "Copy to Ensemble",
        question:
          "Copy From Wardrobe and From Cast Member to the 3 other Ensemble costumes in this item? Anything already in them will be overwritten.",
        to: ["Kim Lee as Pirates", "Sam Patel as Pirates", "Chris Evans as Sailors"],
      },
      {
        label: "Copy to all",
        question:
          "Copy From Wardrobe and From Cast Member to all 4 other costumes in this item? Anything already in them will be overwritten.",
        to: [
          "Alex Morgan as Captain Hook",
          "Kim Lee as Pirates",
          "Sam Patel as Pirates",
          "Chris Evans as Sailors",
        ],
      },
    ]);
  });

  it("offers no copy to the role's type when nobody else is that type", () => {
    const copies = costumeCopiesOf(rows, rowOf(1, alexMorgan.id));

    expect(copies.map(({ label }) => label)).toEqual(["Copy to all"]);
  });

  it("offers no copy to the role's type when it reaches the same rows as Copy to all", () => {
    const ensembleOnly = costumeRowsOf([pirates], [joBrown, kimLee], "opening-number");
    const jo = { role: pirates, member: joBrown };

    expect(costumeCopiesOf(ensembleOnly, jo).map(({ label }) => label)).toEqual(["Copy to all"]);
  });

  it("offers no copies when nobody else is cast in the item", () => {
    const aloneRows = costumeRowsOf([captainHook(), smee], pirateCast, "opening-number");

    expect(costumeCopiesOf(aloneRows, { role: captainHook(), member: alexMorgan })).toEqual([]);
  });

  it("asks about one other costume in the singular", () => {
    const pair = costumeRowsOf(
      [
        captainHook(),
        aRole(5, "opening-number", [kimLee.id], { name: "Mermaid", size: "lead" }),
        pirates,
      ],
      pirateCast,
      "opening-number",
    );

    const [toLeads] = costumeCopiesOf(pair, { role: captainHook(), member: alexMorgan });

    expect(toLeads?.question).toBe(
      "Copy From Wardrobe and From Cast Member to the other Lead costume in this item? Anything already in them will be overwritten.",
    );
  });
});
