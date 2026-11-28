import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { json } from "@/app.fixture.ts";
import { downloadFrom, openFileTab } from "./file-link.ts";
import { openOrDownload } from "./file-open.ts";

// The browser's own new tabs and downloads, which happy-dom can't follow.
vi.mock("./file-link.ts", () => ({ openFileTab: vi.fn(), downloadFrom: vi.fn() }));

const tab = { show: vi.fn(), close: vi.fn() };
const PATH = "/api/stores/scenery/image-link?name=throne.jpg";
const answering = (answer: () => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(answer));

beforeEach(() => {
  vi.mocked(openFileTab).mockReset().mockReturnValue(tab);
  vi.mocked(downloadFrom).mockReset();
  tab.show.mockReset();
  tab.close.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("Opening or downloading a file", () => {
  it("opens the file's link in a new tab, opened before the link is asked for", async () => {
    answering(async () => json({ url: "https://files.example/throne.jpg" }));

    expect(await openOrDownload("throne.jpg", PATH, true)).toEqual({});
    expect(tab.show).toHaveBeenCalledWith("https://files.example/throne.jpg");
    expect(downloadFrom).not.toHaveBeenCalled();
  });

  it("downloads from the file's link, opening no tab", async () => {
    answering(async () => json({ url: "https://files.example/throne.jpg?download" }));

    expect(await openOrDownload("throne.jpg", PATH, false)).toEqual({});
    expect(downloadFrom).toHaveBeenCalledWith("https://files.example/throne.jpg?download");
    expect(openFileTab).not.toHaveBeenCalled();
  });

  it("says a file that's gone isn't there any more, closing its tab", async () => {
    answering(async () => new Response(null, { status: 404 }));

    expect(await openOrDownload("throne.jpg", PATH, true)).toEqual({
      problem: "throne.jpg isn't there any more.",
      gone: true,
    });
    expect(tab.close).toHaveBeenCalled();
  });

  it("says to try again when the link can't be had", async () => {
    answering(() => Promise.reject(new Error("offline")));

    expect(await openOrDownload("throne.jpg", PATH, false)).toEqual({
      problem: "Couldn't download throne.jpg. Try again.",
    });
  });
});
