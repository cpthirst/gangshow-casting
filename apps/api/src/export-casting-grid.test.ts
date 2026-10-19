import { gridLetterColours, unprintedHeadingColour } from "@app/shared";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { exportCastingGrid } from "./export-casting-grid.ts";
import {
  columnPixels,
  readSheet,
  readStyledCells,
  rowHeight,
  type StyledCell,
  sheetXml,
} from "./xlsx.fixture.ts";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).
const grid = {
  items: [
    { heading: "1.1 · Opening Number", printed: true },
    { heading: "1.2 · Pirate Sketch", printed: true },
    { heading: "Entr'acte", printed: false },
  ],
  rows: [
    { firstName: "Sam", lastName: "Example", section: "Scouts", cells: [null, "L", "C"] },
    { firstName: "Alex", lastName: "Sample", section: "Explorers", cells: ["S", null, "E"] },
    { firstName: "Jo", lastName: "Newcomer", section: "Scouts", cells: [null, null, null] },
  ],
};

const request = (body: unknown, productionId = "2027") => ({
  pathParameters: { productionId },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

/** The file in a 200 response: API Gateway sends a binary body as base64. */
const fileIn = (res: APIGatewayProxyStructuredResultV2) => {
  expect(res.isBase64Encoded).toBe(true);
  return new Uint8Array(Buffer.from(res.body ?? "", "base64"));
};

describe("export casting grid handler", () => {
  it("returns an Excel file", async () => {
    const res = await exportCastingGrid(request(grid));

    expect(res.statusCode).toBe(200);
    expect(res.headers?.["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    // An .xlsx is a zip, which starts with "PK".
    expect(Buffer.from(fileIn(res)).subarray(0, 2).toString()).toBe("PK");
  });

  it("puts first name, last name and section first, then a column per item in order", async () => {
    const sheet = readSheet(fileIn(await exportCastingGrid(request(grid))));

    expect(sheet[0]).toEqual([
      "First name",
      "Last name",
      "Section",
      "1.1 · Opening Number",
      "1.2 · Pirate Sketch",
      "Entr'acte",
    ]);
  });

  it("has a row per person, in the order sent", async () => {
    const sheet = readSheet(fileIn(await exportCastingGrid(request(grid))));

    expect(sheet.slice(1).map((row) => row.slice(0, 3))).toEqual([
      ["Sam", "Example", "Scouts"],
      ["Alex", "Sample", "Explorers"],
      ["Jo", "Newcomer", "Scouts"],
    ]);
  });

  it("holds the role-size letter in a filled cell and nothing in an empty one", async () => {
    const sheet = readSheet(fileIn(await exportCastingGrid(request(grid))));

    expect(sheet.slice(1).map((row) => row.slice(3))).toEqual([
      ["", "L", "C"],
      ["S", "", "E"],
      ["", "", ""],
    ]);
  });

  it("writes a name that looks like a formula as plain text, never a formula", async () => {
    const sneaky = {
      items: [{ heading: "1.1 · Opening Number", printed: true }],
      rows: [{ firstName: "=1+1", lastName: "@SUM(A1)", section: "Scouts", cells: ["L"] }],
    };

    const file = fileIn(await exportCastingGrid(request(sneaky)));

    expect(readSheet(file)[1]?.slice(0, 2)).toEqual(["=1+1", "@SUM(A1)"]);
    expect(sheetXml(file)).not.toContain("<f>");
  });

  it("makes a file for a show with no cast yet: just the headings", async () => {
    const empty = { items: [{ heading: "1.1 · Opening Number", printed: true }], rows: [] };

    const sheet = readSheet(fileIn(await exportCastingGrid(request(empty))));

    expect(sheet).toEqual([["First name", "Last name", "Section", "1.1 · Opening Number"]]);
  });

  it.each([
    ["a group", { group: "1st Somewhere" }],
    ["casting notes", { singing: "Strong alto" }],
    ["a role name", { roleName: "Captain Hook" }],
  ])("refuses a row that carries %s with 400, returning no file", async (_name, extra) => {
    const res = await exportCastingGrid(
      request({ ...grid, rows: [{ ...grid.rows[0], ...extra }] }),
    );

    expect(res.statusCode).toBe(400);
    expect(res.isBase64Encoded).toBeUndefined();
  });

  it.each([
    ["not JSON", "{nope"],
    ["empty", ""],
    ["a row with a missing cell", { ...grid, rows: [{ ...grid.rows[0], cells: ["L"] }] }],
  ])("refuses a body that is %s with 400", async (_name, body) => {
    expect((await exportCastingGrid(request(body))).statusCode).toBe(400);
  });

  it("returns 404 for a production id that can't be one", async () => {
    expect((await exportCastingGrid(request(grid, "../etc"))).statusCode).toBe(404);
  });

  describe("layout", () => {
    const fileOf = async () => fileIn(await exportCastingGrid(request(grid)));

    it("turns each item's heading to read upwards, leaving the name headings level", async () => {
      const [headings] = readStyledCells(await fileOf());

      expect(headings?.map(({ text, rotation }) => [text, rotation])).toEqual([
        ["First name", 0],
        ["Last name", 0],
        ["Section", 0],
        ["1.1 · Opening Number", 90],
        ["1.2 · Pirate Sketch", 90],
        ["Entr'acte", 90],
      ]);
    });

    it("fixes each item's column at 60 pixels wide", async () => {
      const widths = columnPixels(await fileOf());

      expect([4, 5, 6].map((column) => widths.get(column))).toEqual([60, 60, 60]);
      // The name columns keep Excel's own width.
      expect([1, 2, 3].map((column) => widths.get(column))).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
    });

    it("centres each item's heading in its cell, across and down", async () => {
      const [headings] = readStyledCells(await fileOf());

      const items = headings?.slice(3) ?? [];
      expect(items.map(({ horizontal, vertical }) => [horizontal, vertical])).toEqual([
        ["center", "center"],
        ["center", "center"],
        ["center", "center"],
      ]);
    });

    const heightFor = async (headings: string[]) => {
      const items = headings.map((heading) => ({ heading, printed: true }));
      const res = await exportCastingGrid(request({ items, rows: [] }));
      return rowHeight(fileIn(res), 1) ?? 0;
    };

    it("fits the heading row to the longest item heading's text", async () => {
      // "1.1 · Opening Number" is about 100 points long in bold 11 pt.
      const height = await heightFor(["1.1 · Opening Number", "1.2 · Pirate Sketch"]);

      expect(height).toBeGreaterThanOrEqual(100);
      expect(height).toBeLessThanOrEqual(125);
    });

    it("sizes the row to the text, not its number of letters", async () => {
      const narrow = await heightFor(["iiiiiiiiiiiiiiii"]);
      const wide = await heightFor(["MMMMMMMMMMMMMMMM"]);

      expect(wide).toBeGreaterThan(narrow * 2);
    });

    it("stops at Excel's tallest row for a very long heading", async () => {
      // The longest heading the export accepts, in its widest letter.
      expect(await heightFor(["W".repeat(130)])).toBe(409);
    });
  });

  describe("colours", () => {
    const cellsOf = async () => readStyledCells(fileIn(await exportCastingGrid(request(grid))));
    const fills = (cells: StyledCell[] | undefined) => cells?.map(({ text, fill }) => [text, fill]);

    it("fills each role letter's cell in its dot's colour, from the grid's own list", async () => {
      const [, sam, alex] = await cellsOf();

      expect(fills(sam)).toContainEqual(["L", gridLetterColours.L]);
      expect(fills(sam)).toContainEqual(["C", gridLetterColours.C]);
      expect(fills(alex)).toContainEqual(["S", gridLetterColours.S]);
      expect(fills(alex)).toContainEqual(["E", gridLetterColours.E]);
    });

    it("fills only the role letters: no empty cell, name or heading has a fill", async () => {
      const cells = (await cellsOf()).flat();

      expect(
        cells
          .filter((cell) => cell.fill !== undefined)
          .map((cell) => cell.text)
          .sort(),
      ).toEqual(["C", "E", "L", "S"]);
      // An empty cell is written with no fill, or not at all.
      expect(
        cells.filter((cell) => cell.text === "").every((cell) => cell.fill === undefined),
      ).toBe(true);
    });

    it("keeps the letter in a filled cell, so the sheet reads in black and white", async () => {
      const [, sam] = await cellsOf();

      expect(sam?.filter((cell) => cell.fill !== undefined).map((cell) => cell.text)).toEqual([
        "L",
        "C",
      ]);
    });

    it("keeps dark text on every fill readable, at 4.5:1 or better", async () => {
      const filled = (await cellsOf()).flat().filter((cell) => cell.fill !== undefined);

      expect(filled).toHaveLength(4);
      for (const { fill, textColour } of filled) {
        expect(contrast(fill ?? "", textColour ?? "")).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("shows an item left out of the printed programme in bold red italics, as the grid does", async () => {
      const [headings] = await cellsOf();

      const entracte = headings?.find((cell) => cell.text === "Entr'acte");
      expect(entracte).toMatchObject({
        bold: true,
        italic: true,
        textColour: unprintedHeadingColour,
      });
      const printed = headings?.find((cell) => cell.text === "1.1 · Opening Number");
      expect(printed).toMatchObject({ bold: true, italic: false, textColour: undefined });
    });
  });
});

/** WCAG contrast ratio of two "#rrggbb" colours. */
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r = 0, g = 0, bl = 0] = [1, 3, 5].map((i) => {
      const channel = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}
