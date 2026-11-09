import { describe, expect, it } from "vitest";
import { itemFileLinkPath, itemFilesPath } from "@/services/production.ts";
import { fileIconOf, fileLabel, fileSize, sortFiles } from "./file-display.ts";
import { icons } from "./icons.ts";

describe("sceneryFilesPath", () => {
  it("is the item's files in the production", () => {
    expect(itemFilesPath("scenery", "opening-number")).toBe(
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
    expect(itemFileLinkPath("scenery", "opening-number", "set plan & build #2.pdf")).toBe(
      "/api/productions/2027/items/opening-number/scenery-file-link?name=set+plan+%26+build+%232.pdf",
    );
  });
});

describe("fileLabel", () => {
  it.each([
    ["set-plan.pdf", "Open set-plan.pdf, PDF file"],
    ["Backdrop.png", "Open Backdrop.png, PNG file"],
    ["build-list.xlsx", "Download build-list.xlsx, XLSX file"],
    ["cues.docx", "Download cues.docx, DOCX file"],
    ["notes.html", "Download notes.html, HTML file"],
    ["notes", "Download notes"],
  ])("names the file for %s %j", (name, label) => {
    expect(fileLabel(name, "scenery")).toBe(label);
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
    expect(fileIconOf(name, "scenery")).toBe(icon);
  });

  it.each(["model.skp", "build-list.csv", "readme", "cue-notes.txt"])(
    "gives %s the general file icon",
    (name) => {
      expect(fileIconOf(name, "scenery")).toBe(icons.file);
    },
  );
});

describe("an SFX file's icon and name", () => {
  it.each(["thunder.mp3", "applause.WAV", "intro.m4a", "chime.aac", "wind.ogg"])(
    "gives %s the audio file icon on SFX, and the general one elsewhere",
    (name) => {
      expect(fileIconOf(name, "sfx")).toBe(icons.audioFile);
      expect(fileIconOf(name, "scenery")).toBe(icons.file);
      expect(fileIconOf(name, "wardrobe")).toBe(icons.file);
    },
  );

  it("says an audio file opens on SFX, and downloads elsewhere", () => {
    expect(fileLabel("thunder.mp3", "sfx")).toBe("Open thunder.mp3, MP3 file");
    expect(fileLabel("thunder.mp3", "wardrobe")).toBe("Download thunder.mp3, MP3 file");
  });

  it("goes by the last extension, so notes.mp3.html only downloads, even on SFX", () => {
    expect(fileLabel("notes.mp3.html", "sfx")).toBe("Download notes.mp3.html, HTML file");
  });
});
