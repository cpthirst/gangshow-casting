import { strFromU8, unzipSync } from "fflate";

/** The text of every cell in an .xlsx file's first sheet, row by row, with "" for an empty
 *  cell: enough to check what a file holds without opening Excel. Shared strings only,
 *  which is how write-excel-file stores text. */
export function readSheet(file: Uint8Array) {
  const parts = unzipSync(file);
  const read = (name: string) => strFromU8(parts[name] ?? new Uint8Array());
  const strings = [...read("xl/sharedStrings.xml").matchAll(/<si><t[^>]*>(.*?)<\/t><\/si>/g)].map(
    (match) => unescapeXml(match[1] ?? ""),
  );
  const rows = [...read("xl/worksheets/sheet1.xml").matchAll(/<row [^>]*>(.*?)<\/row>/g)].map(
    (row) => {
      const cells: string[] = [];
      for (const cell of (row[1] ?? "").matchAll(
        /<c r="([A-Z]+)\d+"[^>]*?t="s"[^>]*><v>(\d+)<\/v>/g,
      )) {
        cells[columnIndex(cell[1] ?? "A")] = strings[Number(cell[2])] ?? "";
      }
      return Array.from(cells, (text) => text ?? "");
    },
  );
  // A row's empty cells aren't written, so a row can come back short: pad every row to the widest.
  const width = Math.max(0, ...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: width }, (_, i) => row[i] ?? ""));
}

/** The sheet's raw XML, to check what is not in it (such as a formula). */
export const sheetXml = (file: Uint8Array) =>
  strFromU8(unzipSync(file)["xl/worksheets/sheet1.xml"] ?? new Uint8Array());

/** "A" → 0, "B" → 1, "AA" → 26. */
const columnIndex = (letters: string) =>
  [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;

const unescapeXml = (text: string) =>
  text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");

/** One cell with how it looks: its text ("" if it holds none), fill and text colour as
 *  "#rrggbb" (undefined when it has none), and whether it is bold or italic. */
export interface StyledCell {
  text: string;
  fill: string | undefined;
  textColour: string | undefined;
  bold: boolean;
  italic: boolean;
  /** Degrees anticlockwise: 90 reads upwards, 0 is level. */
  rotation: number;
}

const rgbOf = (xml: string, tag: string) => {
  const rgb = new RegExp(`<${tag} rgb="FF([0-9A-F]{6})"`).exec(xml)?.[1];
  return rgb ? `#${rgb.toLowerCase()}` : undefined;
};

/** The `<tag>…</tag>` blocks inside a `<group>` of styles.xml, such as each `<font>` in `<fonts>`. */
const blocks = (styles: string, group: string, tag: string) => {
  const inside = new RegExp(`<${group}[^>]*>(.*?)</${group}>`, "s").exec(styles)?.[1] ?? "";
  return [...inside.matchAll(new RegExp(`<${tag}>(.*?)</${tag}>`, "gs"))].map(
    (match) => match[1] ?? "",
  );
};

/** Every cell the first sheet writes, by row, with its style: enough to check a file's colours
 *  without opening Excel. A styled cell with no text comes back too, with text "". */
export function readStyledCells(file: Uint8Array): StyledCell[][] {
  const parts = unzipSync(file);
  const read = (name: string) => strFromU8(parts[name] ?? new Uint8Array());
  const strings = [...read("xl/sharedStrings.xml").matchAll(/<si><t[^>]*>(.*?)<\/t><\/si>/g)].map(
    (match) => unescapeXml(match[1] ?? ""),
  );
  const styles = read("xl/styles.xml");
  const fonts = blocks(styles, "fonts", "font");
  const fills = blocks(styles, "fills", "fill");
  const formats = [
    ...(/<cellXfs[^>]*>(.*?)<\/cellXfs>/s.exec(styles)?.[1] ?? "").matchAll(
      /<xf ([^>]*?)(?:\/>|>(.*?)<\/xf>)/gs,
    ),
  ].map((match) => `${match[1] ?? ""} ${match[2] ?? ""}`);
  const idOf = (xf: string, name: string) =>
    Number(new RegExp(`${name}="(\\d+)"`).exec(xf)?.[1] ?? 0);

  return [...read("xl/worksheets/sheet1.xml").matchAll(/<row [^>]*>(.*?)<\/row>/g)].map((row) =>
    [...(row[1] ?? "").matchAll(/<c r="[A-Z]+\d+"([^>]*?)(?:\/>|>(?:<v>(\d+)<\/v>)?<\/c>)/g)].map(
      (cell) => {
        const xf = formats[Number(/s="(\d+)"/.exec(cell[1] ?? "")?.[1] ?? 0)] ?? "";
        const font = fonts[idOf(xf, "fontId")] ?? "";
        const fill = fills[idOf(xf, "fillId")] ?? "";
        return {
          text: cell[2] === undefined ? "" : (strings[Number(cell[2])] ?? ""),
          fill: rgbOf(fill, "fgColor"),
          textColour: rgbOf(font, "color"),
          bold: font.includes("<b/>"),
          italic: font.includes("<i/>"),
          rotation: Number(/textRotation="(\d+)"/.exec(xf)?.[1] ?? 0),
        };
      },
    ),
  );
}

/** Each column's width in screen pixels, by column number from 1, for the columns the sheet
 *  sets: Excel's own conversion from its stored width at its default font. */
export function columnPixels(file: Uint8Array) {
  const widths = new Map<number, number>();
  for (const [, attributes = ""] of sheetXml(file).matchAll(/<col ([^>]*)\/>/g)) {
    const read = (name: string) => Number(new RegExp(`${name}="([\\d.]+)"`).exec(attributes)?.[1]);
    const pixels = Math.trunc(((256 * read("width") + Math.trunc(128 / 7)) / 256) * 7);
    for (let column = read("min"); column <= read("max"); column++) widths.set(column, pixels);
  }
  return widths;
}

/** A row's set height in points, by row number from 1; undefined if Excel sizes it. */
export const rowHeight = (file: Uint8Array, row: number) => {
  const height = new RegExp(`<row r="${row}"[^>]*\\sht="([\\d.]+)"`).exec(sheetXml(file))?.[1];
  return height === undefined ? undefined : Number(height);
};
