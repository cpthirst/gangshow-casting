import type { Cell, Feature, Row } from "write-excel-file/browser";
import writeExcelFile from "write-excel-file/browser";
import type { MicPlotItem } from "@/utils/mic-plot.ts";

// The Mic Plot workbook (production-mics FR14), laid out as the sound desk's 2026 one: the
// title, then each half under ACT 1 and ACT 2, with a block per item of its channels in rows
// of nine, each channel's name and role under it, and its notes beside. Text goes in as text,
// never a formula (ADR 0033).

const CHANNELS_PER_ROW = 9;
// The item's title, its channels, a narrow gap, then its notes across two columns.
const COLUMN_WIDTHS = [17, ...Array<number>(CHANNELS_PER_ROW).fill(15.8), 7.5, 14.5, 14.5];
const COLUMNS = COLUMN_WIDTHS.length;

// As the 2026 plot's: each half starts again at the first, and neighbours always differ.
const ITEM_FILLS = ["#dbe5f1", "#ff7e79", "#ffd579", "#c6e0b4", "#e4dfec", "#fbe2d5"];

const centred = { align: "center", alignVertical: "center", wrap: true } as const;
const nulls = (count: number) => Array<null>(count).fill(null);

/** A line across the whole sheet, such as the title or a half's heading. */
const banner = (value: string): Row => [
  { value, fontWeight: "bold", ...centred, columnSpan: COLUMNS },
  ...nulls(COLUMNS - 1),
];

/** A cell boxed on every side: an item's title, its Notes heading and its notes. */
const boxed = (value: string, style: Cell = {}): Cell => ({
  ...centred,
  borderStyle: "thin",
  ...style,
  ...(value ? { value } : {}),
});
const BOLD = { fontWeight: "bold" } as const;

// Each channel's Mic, name and role share one box, with no lines between them.
const TOP = { topBorderStyle: "thin", leftBorderStyle: "thin", rightBorderStyle: "thin" } as const;
const MIDDLE = { leftBorderStyle: "thin", rightBorderStyle: "thin" } as const;
const BOTTOM = { ...MIDDLE, bottomBorderStyle: "thin" } as const;
const MIC = { ...TOP, ...BOLD } as const;
const ROLE = { ...BOTTOM, fontStyle: "italic" } as const;
// A mic nobody is on, so only the mics in use stand out in black.
const UNUSED = { textColor: "#808080" } as const;

/** The item's block: its title down the left, then its channels in rows of nine, each a box
 *  of its Mic, then its name, then its role, all in the item's colour; and beside them, its
 *  notes under a Notes heading. */
function itemBlock({ title, mics, notes }: MicPlotItem, fill: string): Row[] {
  // Not boxed: a channel's cells are bordered only on the outside of its box.
  const shaded = (value: string, style: Cell = {}): Cell => ({
    ...centred,
    backgroundColor: fill,
    ...style,
    ...(value ? { value } : {}),
  });
  // The empty space after the last channel is boxed as a channel is, so the rows line up.
  const rowOf = (cells: Cell[], style: Cell) => [
    ...cells,
    ...Array.from({ length: CHANNELS_PER_ROW - cells.length }, () => shaded("", style)),
  ];
  const channelRows = Array.from(
    { length: Math.ceil(mics.length / CHANNELS_PER_ROW) },
    (_, row) => {
      const first = row * CHANNELS_PER_ROW;
      const group = mics.slice(first, first + CHANNELS_PER_ROW);
      return [
        rowOf(
          group.map((mic, i) =>
            shaded(`Mic ${first + i + 1}`, mic.name ? MIC : { ...MIC, ...UNUSED }),
          ),
          MIC,
        ),
        rowOf(
          group.map((mic) => shaded(mic.name, MIDDLE)),
          MIDDLE,
        ),
        rowOf(
          group.map((mic) => shaded(mic.role, ROLE)),
          ROLE,
        ),
      ];
    },
  ).flat();
  const rowSpan = channelRows.length;
  return channelRows.map((channels, i) => {
    if (i === 0) {
      return [
        { ...boxed(title, { backgroundColor: fill, ...BOLD }), rowSpan },
        ...channels,
        null,
        { ...boxed("Notes", BOLD), columnSpan: 2 },
        null,
      ];
    }
    const notesCell = i === 1 ? [{ ...boxed(notes), rowSpan: rowSpan - 1, columnSpan: 2 }] : [];
    return [null, ...channels, null, ...notesCell];
  });
}

// A blank row after each heading and block, as in the 2026 plot.
const halfRows = (name: string, items: MicPlotItem[]): Row[] => [
  banner(name),
  [],
  ...items.flatMap((item, i) => [...itemBlock(item, ITEM_FILLS[i % ITEM_FILLS.length] ?? ""), []]),
];

// write-excel-file only sets the page up for landscape, so this sets A4 portrait, fitted to
// one page wide (paperSize 9 is A4).
const a4Portrait: Feature<File | Blob | ArrayBuffer> = {
  files: {
    transform: {
      "xl/worksheets/sheet{id}.xml": {
        // The sheet's properties come first in it.
        transform: (xml) =>
          xml.replace(
            /<worksheet [^>]*>/,
            (start) => `${start}<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`,
          ),
        insert: () =>
          '<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
          '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>',
      },
    },
  },
};

/** The whole show's mic plot as an .xlsx file, ACT 1 then ACT 2. */
export const micPlotFile = (productionId: string, halves: MicPlotItem[][]) =>
  writeExcelFile(
    [
      banner(`CHESTER GANG SHOW ${productionId} - MIC PLOT`),
      [],
      ...halves.flatMap((items, i) => halfRows(`ACT ${i + 1}`, items)),
    ],
    {
      sheet: "Mic Plot",
      columns: COLUMN_WIDTHS.map((width) => ({ width })),
    },
    { features: [a4Portrait] },
  ).toBlob();
