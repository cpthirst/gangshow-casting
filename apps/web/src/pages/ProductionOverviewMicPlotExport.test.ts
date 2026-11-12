import type { CastMember, ItemMicPlot, Role } from "@app/shared";
import { enableAutoUnmount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openAppAt } from "@/app.fixture.ts";
import {
  bytesOf,
  catchDownloads,
  exportUses,
  generateFrom,
  type SavedFile,
} from "@/services/export-file.fixture.ts";
import {
  castPath,
  departmentNotesPath,
  micPlotPath,
  rolesPath,
  runningOrderPath,
} from "@/services/production.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { readSheet, sheetXml } from "@/utils/excel/xlsx.fixture.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";

// The Overview's Generate Mic Plot button (production-mics FR14, FR16; ADR 0033). Made-up
// names only: tests never use the real cast (CLAUDE.md safeguarding).

enableAutoUnmount(afterEach);

const member = (id: number, firstName: string, lastName: string): CastMember => ({
  id,
  firstName,
  lastName,
  section: "explorers",
  group: "Made-up Explorer Unit",
  // Casting notes are never exported (ADR 0014).
  singing: "Strong alto voice",
  acting: "Confident on stage",
  revision: 1,
});
const alex = member(1, "Alex", "Morgan");
const jo = member(2, "Jo", "Reed");
const show = aRunningOrder([anItem("Space Sketch")], [anItem("Finale")]);
const alien: Role = {
  id: 1,
  itemId: "space-sketch",
  name: "Alien 1",
  size: "lead",
  castMemberIds: [alex.id],
  revision: 1,
};

/** The stand-in API: what it answers can change between the page loading and the export. */
let api: { order: number; plots: ItemMicPlot[]; plotsStatus: number };
let saved: SavedFile[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 5, 10, 0) });
  useLocalSignIn();
  api = {
    order: 200,
    plots: [{ itemId: "space-sketch", mics: [{ channel: 1, castMemberId: alex.id }] }],
    plotsStatus: 200,
  };
  saved = catchDownloads();
  const json = (body: unknown) => new Response(JSON.stringify(body));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === micPlotPath()) {
        return api.plotsStatus === 200
          ? json({ productionId: "2027", items: api.plots })
          : new Response(null, { status: api.plotsStatus });
      }
      if (url === departmentNotesPath("mic-plot")) {
        return json({
          productionId: "2027",
          notes: [{ itemId: "space-sketch", text: "Mics 19–24 on for songs only", revision: 1 }],
        });
      }
      if (url === rolesPath()) return json({ productionId: "2027", roles: [alien] });
      if (url === castPath()) return json({ productionId: "2027", members: [alex, jo] });
      if (url === runningOrderPath()) {
        return api.order === 200 ? json(show) : new Response(null, { status: api.order });
      }
      if (url.endsWith("-notes")) return json({ productionId: "2027", notes: [] });
      return json({ status: "ok", version: "dev" });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useLocalSignIn();
  document.body.innerHTML = "";
});

const openOverview = async () => (await openAppAt("/production/overview")).wrapper;

const generate = (wrapper: VueWrapper) => generateFrom(wrapper, "Generate Mic Plot");

describe("Generate Mic Plot", () => {
  it("lets someone with no permissions download the mic plot as an Excel workbook", async () => {
    await signInAs([], "jo");
    const wrapper = await openOverview();

    await generate(wrapper);

    expect(saved.map(({ name }) => name)).toEqual(["Gang Show 2027 mic plot 2026-11-05.xlsx"]);
  });

  it("holds the mics as saved when it's generated, with the item's notes", async () => {
    const wrapper = await openOverview();
    api.plots = [{ itemId: "space-sketch", mics: [{ channel: 20, castMemberId: jo.id }] }];

    await generate(wrapper);

    const sheet = readSheet(await bytesOf(saved[0]?.file));
    const start = sheet.findIndex((row) => row[0] === "Space Sketch");
    expect(sheet[0]?.[0]).toBe("CHESTER GANG SHOW 2027 - MIC PLOT");
    expect(sheet[start + 7]?.[2]).toBe("Jo Reed");
    expect(sheet.flat()).not.toContain("Alex Morgan");
    expect(sheet.flat()).toContain("Mics 19–24 on for songs only");
  });

  it("holds nothing about the cast beyond their names and roles", async () => {
    const wrapper = await openOverview();

    await generate(wrapper);

    const file = await bytesOf(saved[0]?.file);
    const text = readSheet(file).flat();
    expect(text).toContain("Alex Morgan");
    expect(text).toContain("Alien 1");
    for (const detail of ["Strong alto voice", "Confident on stage", "Made-up Explorer Unit"]) {
      expect(text).not.toContain(detail);
    }
    expect(sheetXml(file)).not.toMatch(/explorers/i);
  });

  it("says the mic plot was generated, and records the use", async () => {
    const wrapper = await openOverview();

    await generate(wrapper);

    expect(wrapper.get("[data-test=announcement]").text()).toBe("Mic plot generated.");
    expect(exportUses()).toEqual([{ event: "export", export: "excel-mic-plot" }]);
  });

  it("says when it can't be made", async () => {
    const wrapper = await openOverview();
    api.plotsStatus = 500;

    await generate(wrapper);

    expect(wrapper.get("[data-test=mics-error]").text()).toBe(
      "Couldn't generate the mic plot. Try again.",
    );
  });

  it("isn't offered, nor are the other exports, without a saved running order", async () => {
    api.order = 404;

    const wrapper = await openOverview();

    expect(wrapper.get("main").text()).toContain("There's no saved running order yet.");
    expect(wrapper.find("main .view-bar").exists()).toBe(false);
  });
});
