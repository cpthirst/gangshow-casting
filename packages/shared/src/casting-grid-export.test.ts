import { describe, expect, it } from "vitest";
import { CastingGridExportRequest } from "./casting-grid-export.ts";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
const grid = {
  items: ["1.1 · Opening Number", "1.2 · Pirate Sketch"],
  rows: [
    { firstName: "Sam", lastName: "Example", section: "Scouts", cells: ["L", null] },
    { firstName: "Alex", lastName: "Sample", section: "Explorers", cells: [null, "E"] },
  ],
};

describe("CastingGridExportRequest", () => {
  it("accepts a grid with a cell for every item in every row", () => {
    expect(CastingGridExportRequest.parse(grid)).toEqual(grid);
  });

  it.each(["L", "S", "C", "E", null])("accepts %s in a cell", (cell) => {
    const request = { ...grid, rows: [{ ...grid.rows[0], cells: [cell, null] }] };
    expect(CastingGridExportRequest.safeParse(request).success).toBe(true);
  });

  it.each(["X", "Lead", "", 1])("refuses %j in a cell", (cell) => {
    const request = { ...grid, rows: [{ ...grid.rows[0], cells: [cell, null] }] };
    expect(CastingGridExportRequest.safeParse(request).success).toBe(false);
  });

  it("refuses a row with the wrong number of cells", () => {
    const request = { ...grid, rows: [{ ...grid.rows[0], cells: ["L"] }] };
    expect(CastingGridExportRequest.safeParse(request).success).toBe(false);
  });

  it.each([
    ["a group", { group: "1st Somewhere" }],
    ["an age band", { ageBand: "11-13" }],
    ["casting notes", { singing: "Strong alto" }],
    ["a role name", { roleName: "Captain Hook" }],
  ])("refuses a row that also carries %s", (_name, extra) => {
    const request = { ...grid, rows: [{ ...grid.rows[0], ...extra }] };
    expect(CastingGridExportRequest.safeParse(request).success).toBe(false);
  });

  it("refuses a field beside the items and rows", () => {
    expect(CastingGridExportRequest.safeParse({ ...grid, title: "Pirates" }).success).toBe(false);
  });

  it("refuses a section that isn't one of the Overview's", () => {
    const request = { ...grid, rows: [{ ...grid.rows[0], section: "Cubs" }] };
    expect(CastingGridExportRequest.safeParse(request).success).toBe(false);
  });

  it("refuses an empty name", () => {
    const request = { ...grid, rows: [{ ...grid.rows[0], firstName: " " }] };
    expect(CastingGridExportRequest.safeParse(request).success).toBe(false);
  });

  it("accepts the biggest show the app allows: 1000 people, 200 items, the longest titles", () => {
    // A running order holds up to 100 items a half, each titled up to 120 characters; the
    // heading adds the half and number, as in "2.100 · ".
    const items = Array.from({ length: 200 }, (_, i) => `2.${i + 1} · ${"T".repeat(120)}`);
    const rows = Array.from({ length: 1000 }, () => ({
      ...grid.rows[0],
      cells: items.map(() => "L"),
    }));

    expect(CastingGridExportRequest.safeParse({ items, rows }).success).toBe(true);
  });

  it("refuses more people than a cast list can hold", () => {
    const rows = Array.from({ length: 1001 }, () => ({ ...grid.rows[0], cells: ["L", null] }));
    expect(CastingGridExportRequest.safeParse({ ...grid, rows }).success).toBe(false);
  });

  it("refuses more items than a running order can hold", () => {
    const items = Array.from({ length: 201 }, (_, i) => `1.${i} · Item`);
    const rows = [{ ...grid.rows[0], cells: items.map(() => null) }];
    expect(CastingGridExportRequest.safeParse({ items, rows }).success).toBe(false);
  });
});
