import { describe, expect, it } from "vitest";
import type { MicPlotItem } from "@/utils/mic-plot.ts";
import { micPlotFile } from "./mic-plot-workbook.ts";
import { mergedRanges, readCells, readSheet, sheetXml } from "./xlsx.fixture.ts";

// The Mic Plot workbook (production-mics FR14), laid out as the 2026 one. Made-up names only:
// tests never use the real cast (CLAUDE.md safeguarding).

const anItem = (title: string, details: Partial<MicPlotItem> = {}): MicPlotItem => ({
  title,
  mics: Array.from({ length: 24 }, () => ({ name: "", role: "" })),
  notes: "",
  ...details,
});

const spaceSketch = anItem("Space Sketch", {
  mics: anItem("").mics.map((mic, i) => {
    if (i === 0) return { name: "Alex Morgan", role: "Alien 1" };
    if (i === 19) return { name: "Jo Reed", role: "" };
    return mic;
  }),
  notes: "Mics 19–24 on for songs only",
});

const halves = [
  [anItem("Opening Number"), spaceSketch, anItem("Camp Song")],
  [anItem("Gang Dance"), anItem("Night Sketch"), anItem("Finale")],
];

const workbook = async (items = halves) =>
  new Uint8Array(await (await micPlotFile("2027", items)).arrayBuffer());

/** The sheet's row (from 0) where the item's block starts, with its title in column A. */
const blockStart = (sheet: string[][], title: string) => sheet.findIndex((row) => row[0] === title);

// Nine rows: three of Mic headings, each with a row of names then roles under it.
const BLOCK_ROWS = 9;
// Column A, then the nine channel columns: the shaded part of a block.
const SHADED_COLUMNS = 10;
// Notes, beside the block after a gap, across columns L and M.
const NOTES = 11;

describe("the Mic Plot workbook", () => {
  it("is headed with the production's year, then each half's items under ACT 1 and ACT 2", async () => {
    const sheet = readSheet(await workbook());

    expect(sheet[0]?.[0]).toBe("CHESTER GANG SHOW 2027 - MIC PLOT");
    const firstColumn = sheet.map((row) => row[0]).filter((text) => text !== "");
    expect(firstColumn).toEqual([
      "CHESTER GANG SHOW 2027 - MIC PLOT",
      "ACT 1",
      "Opening Number",
      "Space Sketch",
      "Camp Song",
      "ACT 2",
      "Gang Dance",
      "Night Sketch",
      "Finale",
    ]);
  });

  it("puts the item in the first column beside its whole block", async () => {
    const file = await workbook();
    const start = blockStart(readSheet(file), "Space Sketch");

    expect(mergedRanges(file)).toContain(`A${start + 1}:A${start + BLOCK_ROWS}`);
  });

  it("lays out the channels in rows of nine, each with its name and role under it", async () => {
    const sheet = readSheet(await workbook());
    const start = blockStart(sheet, "Space Sketch");
    const block = sheet.slice(start, start + BLOCK_ROWS).map((row) => row.slice(1, 10));
    const mics = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => `Mic ${from + i}`);

    expect(block[0]).toEqual(mics(1, 9));
    expect(block[1]).toEqual(["Alex Morgan", ...Array(8).fill("")]);
    expect(block[2]).toEqual(["Alien 1", ...Array(8).fill("")]);
    expect(block[3]).toEqual(mics(10, 18));
    expect(block[4]).toEqual(Array(9).fill(""));
    expect(block[5]).toEqual(Array(9).fill(""));
    expect(block[6]).toEqual([...mics(19, 24), "", "", ""]);
    expect(block[7]).toEqual(["", "Jo Reed", ...Array(7).fill("")]);
    expect(block[8]).toEqual(Array(9).fill(""));
  });

  it("puts the item's notes beside its block under a Notes heading", async () => {
    const file = await workbook();
    const sheet = readSheet(file);
    const start = blockStart(sheet, "Space Sketch");

    expect(sheet[start]?.[NOTES]).toBe("Notes");
    expect(sheet[start + 1]?.[NOTES]).toBe("Mics 19–24 on for songs only");
    expect(mergedRanges(file)).toContain(`L${start + 1}:M${start + 1}`);
    expect(mergedRanges(file)).toContain(`L${start + 2}:M${start + BLOCK_ROWS}`);
  });

  it("leaves the notes space empty for an item without notes", async () => {
    const sheet = readSheet(await workbook());
    const start = blockStart(sheet, "Opening Number");

    expect(sheet[start]?.[NOTES]).toBe("Notes");
    expect(sheet.slice(start + 1, start + BLOCK_ROWS).map((row) => row[NOTES])).toEqual(
      Array(BLOCK_ROWS - 1).fill(""),
    );
  });

  it("shades each item's whole block in one colour, neighbours apart, repeating in each half", async () => {
    const file = await workbook();
    const sheet = readSheet(file);
    const cells = readCells(file);
    const fillsOf = (title: string) => {
      const start = blockStart(sheet, title);
      return new Set(
        cells
          .slice(start, start + BLOCK_ROWS)
          .flatMap((row) => Array.from({ length: SHADED_COLUMNS }, (_, i) => row?.[i]?.fill)),
      );
    };
    const colourOf = (title: string) => {
      const fills = fillsOf(title);
      expect(fills.size).toBe(1);
      return [...fills][0];
    };

    const act1 = halves[0]?.map((item) => colourOf(item.title)) ?? [];
    const act2 = halves[1]?.map((item) => colourOf(item.title)) ?? [];

    expect(act1.every((colour) => colour !== undefined)).toBe(true);
    expect(new Set(act1).size).toBe(3);
    expect(act2).toEqual(act1);
  });

  it("is bold in its headers, centred with thin borders, and set to print on A4 portrait", async () => {
    const file = await workbook();
    const sheet = readSheet(file);
    const cells = readCells(file);
    const start = blockStart(sheet, "Space Sketch");
    const cellAt = (row: number, column: number) => cells[row]?.[column];

    for (const [row, column] of [
      [0, 0],
      [blockStart(sheet, "ACT 1"), 0],
      [start, 0],
      [start, 1],
      [start + 3, 9],
      [start, NOTES],
    ] as const) {
      expect(cellAt(row, column)?.bold).toBe(true);
    }
    expect(cellAt(start + 1, 1)?.bold).toBe(false);
    for (let row = start; row < start + BLOCK_ROWS; row++) {
      for (const column of [...Array(SHADED_COLUMNS).keys(), NOTES, NOTES + 1]) {
        expect(cellAt(row, column)).toMatchObject({ horizontal: "center", border: "thin" });
      }
    }
    const xml = sheetXml(file);
    expect(xml).toMatch(/<pageSetup [^>]*paperSize="9"/);
    expect(xml).toMatch(/<pageSetup [^>]*orientation="portrait"/);
    // Fitted to one page wide, however long the show runs.
    expect(xml).toMatch(/<worksheet [^>]*><sheetPr><pageSetUpPr fitToPage="1"\/>/);
    expect(xml).toMatch(/<pageSetup [^>]*fitToWidth="1" fitToHeight="0"/);
  });

  it("keeps a name that looks like a formula as text", async () => {
    const file = await workbook([
      [
        anItem("Space Sketch", {
          mics: [{ name: "=SUM(A1) Morgan", role: "" }, ...anItem("").mics.slice(1)],
        }),
      ],
      [],
    ]);
    const sheet = readSheet(file);

    expect(sheet[blockStart(sheet, "Space Sketch") + 1]?.[1]).toBe("=SUM(A1) Morgan");
    expect(sheetXml(file)).not.toContain("<f>");
  });
});
