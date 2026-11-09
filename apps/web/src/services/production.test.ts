import { beforeEach, describe, expect, it, vi } from "vitest";
import { castingGridExportPath } from "./casting-grid-export.ts";
import {
  addPropPath,
  castPath,
  departmentNotesPath,
  fileCountsPath,
  forgetProductionDeletedWhileOpen,
  itemFilesPath,
  itemNotesPath,
  listProductions,
  micPlotPath,
  openProduction,
  openProductionYear,
  productionDeletedWhileOpen,
  propsPath,
  rolesPath,
  runningOrderPath,
  saveDepartmentNotesPath,
} from "./production.ts";

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

describe("a list that no longer holds the open production", () => {
  beforeEach(() => openProduction("2027"));

  it("opens the newest, and remembers which one had gone", () => {
    listProductions(["2026", "2028"]);

    expect(openProductionYear()).toBe("2028");
    expect(productionDeletedWhileOpen()).toBe("2027");
  });

  it("changes nothing while the list still holds it", () => {
    listProductions(["2027", "2028"]);

    expect(openProductionYear()).toBe("2027");
    expect(productionDeletedWhileOpen()).toBeUndefined();
  });

  it("stops remembering once it's forgotten", () => {
    listProductions(["2028"]);

    forgetProductionDeletedWhileOpen();

    expect(productionDeletedWhileOpen()).toBeUndefined();
  });
});
