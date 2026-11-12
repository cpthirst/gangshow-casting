import { flushPromises, type VueWrapper } from "@vue/test-utils";
import { expect, vi } from "vitest";

// Catching the exports a test makes, instead of downloading them.

export interface SavedFile {
  name: string;
  file: Blob;
}

/** Every file the app hands the user from now on, by name, as `saveFile` would download it.
 *  Call it before each test; restoring the mocks stops it. */
export function catchDownloads() {
  const saved: SavedFile[] = [];
  let lastFile: Blob | undefined;
  URL.createObjectURL = vi.fn((file: Blob) => {
    lastFile = file;
    return "blob:made-up";
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (lastFile) saved.push({ name: this.download, file: lastFile });
  });
  return saved;
}

/** A saved file's bytes, to read it back; none for a file that wasn't saved. */
export const bytesOf = async (file: Blob | undefined) =>
  new Uint8Array(file ? await file.arrayBuffer() : new ArrayBuffer(0));

/** The exports recorded for the Usage page, through a stubbed `fetch`. */
export const exportUses = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([url, init]) => url === "/api/usage" && init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init?.body)))
    .filter((body) => body.event === "export");

/** Presses the page's button with this label, then waits while it's busy: until its file is
 *  saved or it has said it couldn't be. */
export async function generateFrom(wrapper: VueWrapper, label: string) {
  const button = wrapper.findAll("main button").find((found) => found.text() === label);
  await button?.trigger("click");
  // Building the file is real work in the browser: let it finish.
  await vi.waitFor(() => expect(button?.attributes("disabled")).toBeUndefined());
  await flushPromises();
}
