import { describe, expect, it } from "vitest";
import { exportFileName, exportRequestOf } from "./casting-grid-export.ts";
import type { GridColumn, GridRow } from "./overview.ts";

describe("exportFileName", () => {
  it("names the file for the production and the date", () => {
    expect(exportFileName("Gang Show 2027", new Date(2027, 2, 12))).toBe(
      "Gang Show 2027 casting grid 2027-03-12.xlsx",
    );
  });

  it("uses the day on the user's clock, not UTC's", () => {
    // Just after midnight in the evening's time zone is still the same local day.
    expect(exportFileName("Show", new Date(2027, 11, 1, 0, 30))).toBe(
      "Show casting grid 2027-12-01.xlsx",
    );
  });

  it("swaps characters a file name can't hold for a space", () => {
    expect(exportFileName('Pirates: "The/Show"?', new Date(2027, 0, 5))).toBe(
      "Pirates The Show casting grid 2027-01-05.xlsx",
    );
  });
});

describe("exportRequestOf", () => {
  const columns: GridColumn[] = [
    { itemId: "opening", title: "Opening Number", number: 1, halfNumber: 1 },
    {
      itemId: "entracte",
      title: "Entr'acte that runs on for a good while",
      number: null,
      halfNumber: 1,
    },
  ];
  const sam: GridRow = {
    id: 1,
    firstName: "Sam",
    lastName: "Example",
    section: "Scouts",
    clashLines: [],
    slots: [
      { itemId: "opening", title: "Opening Number", number: 1, part: "support" },
      { itemId: "entracte", title: "Entr'acte", number: null, part: undefined },
    ],
  };

  it("sends whole headings, and which items are in the printed programme", () => {
    expect(exportRequestOf(columns, [sam]).items).toEqual([
      { heading: "1.1 · Opening Number", printed: true },
      { heading: "Entr'acte that runs on for a good while", printed: false },
    ]);
  });

  it("sends each person's name, section and a role letter or nothing per item", () => {
    expect(exportRequestOf(columns, [sam]).rows).toEqual([
      { firstName: "Sam", lastName: "Example", section: "Scouts", cells: ["S", null] },
    ]);
  });

  it("sends nothing else about a person: no id, no clash text", () => {
    expect(Object.keys(exportRequestOf(columns, [sam]).rows[0] ?? {}).sort()).toEqual([
      "cells",
      "firstName",
      "lastName",
      "section",
    ]);
  });
});
