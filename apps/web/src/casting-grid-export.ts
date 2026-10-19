import type { CastingGridExportRequest } from "@app/shared";
import { exportFileName, saveFile } from "./export-file.ts";
import { fullGridHeading, type GridColumn, type GridRow } from "./overview.ts";
import { roleSizeLetter } from "./roles.ts";
import { apiFetch } from "./sign-in.ts";

// Only one production for now (see docs/product/running-order/prd.md).
/** Every role (ADR 0021): the server turns the grid it is sent into an Excel file (ADR 0019). */
export const EXPORT_PATH = "/api/productions/2027/casting-grid/export";

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
    saveFile(await res.blob(), exportFileName(production, day, "casting grid", "xlsx"));
    return true;
  } catch {
    return false;
  }
}
