import { beforeEach, describe, expect, it, vi } from "vitest";
import { castingGridExportPath } from "@/services/casting-grid-export.ts";
import { castPath } from "./cast.ts";
import { fileCountsPath, itemFilesPath } from "./item-files.ts";
import { departmentNotesPath, itemNotesPath, saveDepartmentNotesPath } from "./item-notes.ts";
import { micPlotPath } from "./mic-plot.ts";
import { openProduction } from "./production.ts";
import { addPropPath, propsPath } from "./props.ts";
import { rolesPath } from "./roles.ts";
import { runningOrderPath } from "./running-order.ts";

describe("the production the app shows", () => {
  beforeEach(() => openProduction("2028"));

  it.each([
    ["cast", castPath, "cast"],
    ["running order", runningOrderPath, "running-order"],
    ["casting", rolesPath, "roles"],
    ["casting grid export", castingGridExportPath, "casting-grid/export"],
    ["props", propsPath, "props"],
    ["an item's props", () => addPropPath("opening-number"), "items/opening-number/props"],
    ["mics", micPlotPath, "mic-plot"],
    ["casting notes", itemNotesPath, "item-notes"],
    ["a department's notes", () => departmentNotesPath("props"), "props-notes"],
    [
      "an item's department notes",
      () => saveDepartmentNotesPath("sfx", "opening-number"),
      "items/opening-number/sfx-notes",
    ],
    [
      "an item's files",
      () => itemFilesPath("scenery", "opening-number"),
      "items/opening-number/scenery-files",
    ],
    ["file counts", () => fileCountsPath("wardrobe"), "wardrobe-file-counts"],
  ])("is the open one for the %s", (_what, path, rest) => {
    expect(path()).toBe(`/api/productions/2028/${rest}`);
  });
});

describe("the app's code", () => {
  it("asks for no production as it loads, before one is open", async () => {
    vi.resetModules();
    const modules = import.meta.glob(["../**/*.{ts,vue}", "!../**/*.test.ts", "!../main.ts"]);

    for (const load of Object.values(modules)) await load();
  });
});
