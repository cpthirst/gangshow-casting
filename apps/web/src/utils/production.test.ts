import { describe, expect, it } from "vitest";
import { EXPORT_PATH } from "@/services/casting-grid-export.ts";
import { CAST_PATH } from "./cast.ts";
import { fileCountsPath, itemFilesPath } from "./item-files.ts";
import { departmentNotesPath, ITEM_NOTES_PATH, saveDepartmentNotesPath } from "./item-notes.ts";
import { MIC_PLOT_PATH } from "./mic-plot.ts";
import { addPropPath, PROPS_PATH } from "./props.ts";
import { ROLES_PATH } from "./roles.ts";
import { RUNNING_ORDER_PATH } from "./running-order.ts";

describe("the production the app shows", () => {
  it.each([
    ["cast", CAST_PATH, "cast"],
    ["running order", RUNNING_ORDER_PATH, "running-order"],
    ["casting", ROLES_PATH, "roles"],
    ["casting grid export", EXPORT_PATH, "casting-grid/export"],
    ["props", PROPS_PATH, "props"],
    ["an item's props", addPropPath("opening-number"), "items/opening-number/props"],
    ["mics", MIC_PLOT_PATH, "mic-plot"],
    ["casting notes", ITEM_NOTES_PATH, "item-notes"],
    ["a department's notes", departmentNotesPath("props"), "props-notes"],
    [
      "an item's department notes",
      saveDepartmentNotesPath("sfx", "opening-number"),
      "items/opening-number/sfx-notes",
    ],
    [
      "an item's files",
      itemFilesPath("scenery", "opening-number"),
      "items/opening-number/scenery-files",
    ],
    ["file counts", fileCountsPath("wardrobe"), "wardrobe-file-counts"],
  ])("is 2027 for the %s", (_what, path, rest) => {
    expect(path).toBe(`/api/productions/2027/${rest}`);
  });
});
