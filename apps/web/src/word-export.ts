import { exportFileName, saveFile } from "./export-file.ts";
import type { LatestShow } from "./latest-show.ts";
import type { ShowHalf } from "./overview.ts";

// The Word exports are built in the browser, and their library is loaded only when one is
// used, so it never weighs on the page's first load (ADR 0022). Each returns false if the
// file couldn't be made, so nothing was saved.

async function save(make: () => Promise<Blob>, name: string) {
  try {
    saveFile(await make(), name);
    return true;
  } catch {
    return false;
  }
}

/** The By item view as the Item Overview. */
export const downloadItemOverview = (title: string, halves: ShowHalf[], day = new Date()) =>
  save(
    async () => (await import("./item-overview-document.ts")).itemOverviewFile(title, halves),
    exportFileName(title, day, "item overview", "docx"),
  );

/** A casting sheet for every cast member. */
export const downloadCastingSheets = (show: LatestShow, day = new Date()) =>
  save(
    async () => (await import("./casting-sheets-document.ts")).castingSheetsFile(show),
    exportFileName(show.order.title, day, "casting sheets", "docx"),
  );
