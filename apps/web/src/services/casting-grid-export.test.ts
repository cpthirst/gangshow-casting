import { describe, expect, it } from "vitest";
import type { GridColumn, GridRow } from "@/utils/overview.ts";
import { exportRequestOf } from "./casting-grid-export.ts";

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
