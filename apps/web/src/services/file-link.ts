// Following a scenery file's short-lived link (production-scenery FR10): to a new tab for a
// file the browser shows, or straight to the download for any other.

/** A new tab waiting for a file whose link is on its way. */
export interface FileTab {
  show(url: string): void;
  close(): void;
}

/** What the tab needs of window.open's result. */
interface BlankTab {
  opener: unknown;
  location: { href: string };
  close(): void;
}

type Open = (url: string, target: string, features?: string) => BlankTab | null;

/**
 * Opens a blank tab now, on the user's click: a phone blocks one opened after waiting for the
 * API as a pop-up. If the browser blocks it anyway, the file gets a tab of its own later.
 */
export function openFileTab(open: Open = (...args) => window.open(...args)): FileTab {
  const tab = open("", "_blank");
  return {
    show(url) {
      if (!tab) {
        open(url, "_blank", "noopener");
        return;
      }
      // The file's page mustn't be able to steer the app's tab.
      tab.opener = null;
      tab.location.href = url;
    },
    close() {
      tab?.close();
    },
  };
}

/** Follows a link that tells the browser to save its file, so the page stays where it is. */
export function downloadFrom(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.click();
}
