import { describe, expect, it } from "vitest";
import { alexMorgan, aRole, captainHook, pirateCast, pirates, smee } from "./casting.fixture.ts";
import { costumeRowsOf } from "./costumes.ts";

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
