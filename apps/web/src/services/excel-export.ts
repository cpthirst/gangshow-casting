import type { MicPlotItem } from "@/utils/mic-plot.ts";
import { exportFileName, saveFile } from "./export-file.ts";

// The Excel workbooks built in the browser, with their library loaded only when one is used,
// as the Word exports are (ADR 0033). Each returns false if the file couldn't be made, so
// nothing was saved.

/** The whole show's mic plot. */
export async function downloadMicPlot(
  plot: { title: string; productionId: string; halves: MicPlotItem[][] },
  day = new Date(),
) {
  try {
    const { micPlotFile } = await import("@/utils/excel/mic-plot-workbook.ts");
    saveFile(
      await micPlotFile(plot.productionId, plot.halves),
      exportFileName(plot.title, day, "mic plot", "xlsx"),
    );
    return true;
  } catch {
    return false;
  }
}
