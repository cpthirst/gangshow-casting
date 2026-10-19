import { exportFileName, saveFile } from "./export-file.ts";
import type { ShowHalf } from "./overview.ts";

// The Word exports are built in the browser, and their library is loaded only when one is
// used, so it never weighs on the page's first load (ADR 0022).

/** Makes the Item Overview and hands it to the user: false if that didn't work, so nothing
 *  was saved. */
export async function downloadItemOverview(title: string, halves: ShowHalf[], day = new Date()) {
  try {
    const { itemOverviewFile } = await import("./item-overview-document.ts");
    saveFile(
      await itemOverviewFile(title, halves),
      exportFileName(title, day, "item overview", "docx"),
    );
    return true;
  } catch {
    return false;
  }
}
