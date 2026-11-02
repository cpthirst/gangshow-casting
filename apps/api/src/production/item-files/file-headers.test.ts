import { describe, expect, it } from "vitest";
import { fileHeadersOf } from "./file-headers.ts";

describe("the headers a scenery file is sent with", () => {
  it("opens a PDF in the browser, as a PDF, under its stored name", () => {
    expect(fileHeadersOf("set-plan.pdf")).toEqual({
      contentType: "application/pdf",
      contentDisposition: `inline; filename="set-plan.pdf"; filename*=UTF-8''set-plan.pdf`,
    });
  });

  it("downloads any other file under its stored name, as bytes the browser won't show", () => {
    expect(fileHeadersOf("build-list.xlsx")).toEqual({
      contentType: "application/octet-stream",
      contentDisposition: `attachment; filename="build-list.xlsx"; filename*=UTF-8''build-list.xlsx`,
    });
  });

  it.each(["notes.html", "plan.svg"])("downloads %s, which could run script", (name) => {
    expect(fileHeadersOf(name)).toEqual(
      expect.objectContaining({
        contentType: "application/octet-stream",
        contentDisposition: expect.stringMatching(/^attachment;/),
      }),
    );
  });

  it("keeps a name with quotes, spaces and accents, with a plain fallback for old browsers", () => {
    expect(fileHeadersOf(`Café "plan" (v2).xlsx`).contentDisposition).toBe(
      `attachment; filename="Caf_ _plan_ (v2).xlsx"; filename*=UTF-8''Caf%C3%A9%20%22plan%22%20%28v2%29.xlsx`,
    );
  });
});
