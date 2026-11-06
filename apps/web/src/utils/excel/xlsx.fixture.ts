import { strFromU8, unzipSync } from "fflate";

// Reads back what an .xlsx file holds, without opening Excel. write-excel-file stores all
// text as shared strings, which is all these read.

const partOf = (file: Uint8Array, name: string) =>
  strFromU8(unzipSync(file)[name] ?? new Uint8Array());

/** The first sheet's raw XML, to check its page setup and what is not in it (such as a
 *  formula). */
export const sheetXml = (file: Uint8Array) => partOf(file, "xl/worksheets/sheet1.xml");

const unescapeXml = (text: string) =>
  text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");

const colourOf = (rgb: RegExpExecArray | null) =>
  rgb?.[1] ? `#${rgb[1].toLowerCase()}` : undefined;

type BorderSide = "top" | "right" | "bottom" | "left";
const sideOf = (border: string, side: BorderSide) =>
  new RegExp(`<${side} style="(\\w+)"`).exec(border)?.[1];

/** "A" → 0, "B" → 1, "AA" → 26. */
const columnIndex = (letters: string) =>
  [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;

/** The `<tag>…</tag>` blocks inside a `<group>` of styles.xml, such as each `<font>` in `<fonts>`. */
const blocks = (styles: string, group: string, tag: string) => {
  const inside = new RegExp(`<${group}[^>]*>(.*?)</${group}>`, "s").exec(styles)?.[1] ?? "";
  return [...inside.matchAll(new RegExp(`<${tag}>(.*?)</${tag}>`, "gs"))].map(
    (match) => match[1] ?? "",
  );
};

/** One cell with how it looks. */
export interface StyledCell {
  text: string;
  /** "#rrggbb", or undefined for none. */
  fill: string | undefined;
  bold: boolean;
  italic: boolean;
  /** Its text's colour as "#rrggbb", or undefined for Excel's default (black). */
  colour: string | undefined;
  /** Where the text sits across its cell; undefined is Excel's default. */
  horizontal: string | undefined;
  /** Each side's border style, such as "thin"; undefined for none. */
  borders: Record<BorderSide, string | undefined>;
}

/** Every cell of the first sheet, row by row and column by column from A1, with its style.
 *  A cell the sheet doesn't write comes back as undefined. */
export function readCells(file: Uint8Array): (StyledCell | undefined)[][] {
  const strings = [
    ...partOf(file, "xl/sharedStrings.xml").matchAll(/<si><t[^>]*>(.*?)<\/t><\/si>/gs),
  ].map((match) => unescapeXml(match[1] ?? ""));
  const styles = partOf(file, "xl/styles.xml");
  const fonts = blocks(styles, "fonts", "font");
  const fills = blocks(styles, "fills", "fill");
  const borders = blocks(styles, "borders", "border");
  const formats = [
    ...(/<cellXfs[^>]*>(.*?)<\/cellXfs>/s.exec(styles)?.[1] ?? "").matchAll(
      /<xf ([^>]*?)(?:\/>|>(.*?)<\/xf>)/gs,
    ),
  ].map((match) => `${match[1] ?? ""} ${match[2] ?? ""}`);
  const idOf = (xf: string, name: string) =>
    Number(new RegExp(`${name}="(\\d+)"`).exec(xf)?.[1] ?? 0);

  const rows: (StyledCell | undefined)[][] = [];
  for (const [, number = "1", inside = ""] of sheetXml(file).matchAll(
    // An empty row is written as <row r="2"/>.
    /<row r="(\d+)"[^>]*?(?:\/>|>(.*?)<\/row>)/gs,
  )) {
    const cells: (StyledCell | undefined)[] = [];
    for (const [, column = "A", attributes = "", value] of inside.matchAll(
      /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(?:<v>(\d+)<\/v>)?<\/c>)/g,
    )) {
      const xf = formats[Number(/s="(\d+)"/.exec(attributes)?.[1] ?? 0)] ?? "";
      const fill = fills[idOf(xf, "fillId")] ?? "";
      const font = fonts[idOf(xf, "fontId")] ?? "";
      const border = borders[idOf(xf, "borderId")] ?? "";
      cells[columnIndex(column)] = {
        text: value === undefined ? "" : (strings[Number(value)] ?? ""),
        fill: colourOf(/<fgColor rgb="FF([0-9A-F]{6})"/.exec(fill)),
        bold: font.includes("<b/>"),
        italic: font.includes("<i/>"),
        colour: colourOf(/<color rgb="FF([0-9A-F]{6})"/.exec(font)),
        horizontal: /<alignment [^>]*horizontal="(\w+)"/.exec(xf)?.[1],
        borders: {
          top: sideOf(border, "top"),
          right: sideOf(border, "right"),
          bottom: sideOf(border, "bottom"),
          left: sideOf(border, "left"),
        },
      };
    }
    rows[Number(number) - 1] = cells;
  }
  return rows;
}

/** Each row's text, with "" for a cell that holds none, padded to the widest row. */
export function readSheet(file: Uint8Array) {
  const rows = Array.from(readCells(file), (row) => row ?? []);
  const width = Math.max(0, ...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: width }, (_, i) => row[i]?.text ?? ""));
}

/** The sheet's merged ranges, such as "A3:A11". */
export const mergedRanges = (file: Uint8Array) =>
  [...sheetXml(file).matchAll(/<mergeCell ref="([A-Z0-9:]+)"/g)].map((match) => match[1]);
