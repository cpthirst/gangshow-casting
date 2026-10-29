import { describe, expect, it } from "vitest";
import { icons } from "./icons.ts";
import {
  fileIconOf,
  fileSize,
  sceneryFileLinkPath,
  sceneryFilesPath,
  sortFiles,
  tileLabel,
} from "./scenery.ts";

describe("sceneryFilesPath", () => {
  it("is the item's files in the production", () => {
    expect(sceneryFilesPath("opening-number")).toBe(
      "/api/productions/2027/items/opening-number/scenery-files",
    );
  });
});

describe("sortFiles", () => {
  it("sorts by name, ignoring case", () => {
    const files = [
      { name: "set-plan.pdf", size: 1 },
      { name: "build-list.xlsx", size: 1 },
      { name: "Backdrop.png", size: 1 },
    ];

    expect(sortFiles(files).map((file) => file.name)).toEqual([
      "Backdrop.png",
      "build-list.xlsx",
      "set-plan.pdf",
    ]);
  });

  it("puts numbered names in number order", () => {
    const files = [
      { name: "scene 10.png", size: 1 },
      { name: "scene 2.png", size: 1 },
    ];

    expect(sortFiles(files).map((file) => file.name)).toEqual(["scene 2.png", "scene 10.png"]);
  });
});

describe("fileSize", () => {
  it.each([
    [0, "0 bytes"],
    [1, "1 byte"],
    [999, "999 bytes"],
    [40_000, "40 KB"],
    [800_000, "800 KB"],
    [999_499, "999 KB"],
    [2_400_000, "2.4 MB"],
    [100_000_000, "100 MB"],
    [3_200_000_000, "3.2 GB"],
  ])("writes %i bytes as %s", (bytes, written) => {
    expect(fileSize(bytes)).toBe(written);
  });
});

describe("sceneryFileLinkPath", () => {
  it("asks for a link to one of the item's files, by its name", () => {
    expect(sceneryFileLinkPath("opening-number", "set plan & build #2.pdf")).toBe(
      "/api/productions/2027/items/opening-number/scenery-file-link?name=set+plan+%26+build+%232.pdf",
    );
  });
});

describe("tileLabel", () => {
  it.each([
    ["set-plan.pdf", "Open set-plan.pdf, PDF file"],
    ["Backdrop.png", "Open Backdrop.png, PNG file"],
    ["build-list.xlsx", "Download build-list.xlsx, XLSX file"],
    ["notes.html", "Download notes.html, HTML file"],
    ["notes", "Download notes"],
  ])("names the tile for %s %j", (name, label) => {
    expect(tileLabel(name)).toBe(label);
  });
});

describe("fileIconOf", () => {
  it.each([
    ["plan.pdf", icons.pdfFile],
    ["PLAN.PDF", icons.pdfFile],
    ["notes.docx", icons.wordFile],
    ["old-notes.doc", icons.wordFile],
    ["build.xlsx", icons.excelFile],
    ["costs.xls", icons.excelFile],
    ["pitch.pptx", icons.powerPointFile],
    ["pitch-2026.ppt", icons.powerPointFile],
    ["Backdrop.png", icons.imageFile],
    ["PHOTO.JPEG", icons.imageFile],
    ["photo.jpg", icons.imageFile],
    ["sketch.gif", icons.imageFile],
    ["sketch.webp", icons.imageFile],
    ["logo.svg", icons.imageFile],
    ["scan.tiff", icons.imageFile],
    ["scan.tif", icons.imageFile],
    ["drawing.bmp", icons.imageFile],
    ["render.avif", icons.imageFile],
    ["phone.heic", icons.imageFile],
  ])("gives %s its type's icon", (name, icon) => {
    expect(fileIconOf(name)).toBe(icon);
  });

  it.each(["model.skp", "build-list.csv", "readme", "cue-notes.txt"])(
    "gives %s the general file icon",
    (name) => {
      expect(fileIconOf(name)).toBe(icons.file);
    },
  );
});
