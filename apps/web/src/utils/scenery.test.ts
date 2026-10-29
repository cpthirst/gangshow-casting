import { describe, expect, it } from "vitest";
import { fileSize, sceneryFilesPath, sortFiles } from "./scenery.ts";

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
