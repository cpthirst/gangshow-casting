import type { CastingGridExportRequest } from "@app/shared";
import { fullGridHeading, type GridColumn, type GridRow } from "./overview.ts";
import { roleSizeLetter } from "./roles.ts";
import { apiFetch } from "./sign-in.ts";

// Only one production for now (see docs/product/running-order/prd.md).
/** Admins only (ADR 0019): the server turns the grid it is sent into an Excel file. */
export const EXPORT_PATH = "/api/productions/2027/casting-grid/export";

/** Who the file is for: it is a copy of the cast's names outside the app's access control. */
export const EXPORT_NOTE = "The file holds the cast's names: for the production team only.";

/** The grid exactly as shown, for the server to make a file from: whole item headings (the
 *  screen cuts long ones short) and one role letter, or nothing, in each cell. */
export const exportRequestOf = (
  columns: GridColumn[],
  rows: GridRow[],
): CastingGridExportRequest => ({
  items: columns.map((column) => ({
    heading: fullGridHeading(column),
    printed: column.number !== null,
  })),
  rows: rows.map(({ firstName, lastName, section, slots }) => ({
    firstName,
    lastName,
    section,
    cells: slots.map((slot) => (slot.part ? roleSizeLetter(slot.part) : null)),
  })),
});

/** Hands the user a file to keep, as a click on a link to it would. */
export function saveFile(file: Blob, name: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** "Gang Show 2027 casting grid 2027-03-12.xlsx": the production and the day, on the user's
 *  clock, with characters a file name can't hold swapped for spaces. */
export function exportFileName(production: string, day: Date) {
  const name = production
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const date = [day.getFullYear(), day.getMonth() + 1, day.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
  return `${name} casting grid ${date}.xlsx`;
}

/** Asks the server for the grid as an Excel file and hands it to the user: false if that
 *  didn't work, so nothing was saved. */
export async function downloadGridExport(
  production: string,
  columns: GridColumn[],
  rows: GridRow[],
  day = new Date(),
) {
  try {
    const res = await apiFetch(EXPORT_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(exportRequestOf(columns, rows)),
    });
    if (!res.ok) return false;
    saveFile(await res.blob(), exportFileName(production, day));
    return true;
  } catch {
    return false;
  }
}
