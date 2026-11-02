import { describe, expect, it } from "vitest";
import { fileHeadersOf } from "./file-headers.ts";

describe("the headers an item file is sent with", () => {
  it("opens a PDF in the browser, as a PDF, under its stored name", () => {
    expect(fileHeadersOf("set-plan.pdf", "scenery")).toEqual({
      contentType: "application/pdf",
      contentDisposition: `inline; filename="set-plan.pdf"; filename*=UTF-8''set-plan.pdf`,
    });
  });

  it("downloads any other file under its stored name, as bytes the browser won't show", () => {
    expect(fileHeadersOf("build-list.xlsx", "scenery")).toEqual({
      contentType: "application/octet-stream",
      contentDisposition: `attachment; filename="build-list.xlsx"; filename*=UTF-8''build-list.xlsx`,
    });
  });

  it.each(["notes.html", "plan.svg"])("downloads %s, which could run script", (name) => {
    expect(fileHeadersOf(name, "scenery")).toEqual(
      expect.objectContaining({
        contentType: "application/octet-stream",
        contentDisposition: expect.stringMatching(/^attachment;/),
      }),
    );
  });

  it("keeps a name with quotes, spaces and accents, with a plain fallback for old browsers", () => {
    expect(fileHeadersOf(`Café "plan" (v2).xlsx`, "scenery").contentDisposition).toBe(
      `attachment; filename="Caf_ _plan_ (v2).xlsx"; filename*=UTF-8''Caf%C3%A9%20%22plan%22%20%28v2%29.xlsx`,
    );
  });

  it("plays an SFX audio file in the browser, as audio, under its stored name", () => {
    expect(fileHeadersOf("thunder.mp3", "sfx")).toEqual({
      contentType: "audio/mpeg",
      contentDisposition: `inline; filename="thunder.mp3"; filename*=UTF-8''thunder.mp3`,
    });
  });

  it("downloads an SFX file named for audio but ending in .html", () => {
    expect(fileHeadersOf("notes.mp3.html", "sfx")).toEqual(
      expect.objectContaining({
        contentType: "application/octet-stream",
        contentDisposition: expect.stringMatching(/^attachment;/),
      }),
    );
  });

  it.each(["scenery", "wardrobe"] as const)("downloads an audio file on %s", (department) => {
    expect(fileHeadersOf("thunder.mp3", department).contentDisposition).toMatch(/^attachment;/);
  });
});
