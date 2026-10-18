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
