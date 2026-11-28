import { ItemFileLink } from "@app/shared";
import { downloadFrom, openFileTab } from "./file-link.ts";
import { loadData } from "./load-data.ts";

/** What came of opening, downloading or removing a file: why it didn't work, if it didn't,
 *  and whether it has gone since the page loaded, so the page can catch up. */
export interface FileOutcome {
  problem?: string;
  gone?: true;
}

/**
 * Opens a file in a new tab, or downloads it, through the short-lived link the API gives at
 * the path (production-scenery FR10, production-image-gallery FR10): an item's file or a
 * store's image alike.
 */
export async function openOrDownload(
  name: string,
  path: string,
  opens: boolean,
): Promise<FileOutcome> {
  // Opened on the click, before waiting for the API, or a phone blocks it as a pop-up.
  const tab = opens ? openFileTab() : undefined;
  try {
    const link = await loadData(path, ItemFileLink);
    if (!link) {
      tab?.close();
      return { problem: `${name} isn't there any more.`, gone: true };
    }
    if (tab) tab.show(link.url);
    else downloadFrom(link.url);
    return {};
  } catch {
    tab?.close();
    return { problem: `Couldn't ${tab ? "open" : "download"} ${name}. Try again.` };
  }
}
