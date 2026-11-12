import type { CastMember, Costume } from "@app/shared";
import { enableAutoUnmount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { json, openAppAt } from "@/app.fixture.ts";
import {
  bytesOf,
  catchDownloads,
  exportUses,
  generateFrom,
  type SavedFile,
} from "@/services/export-file.fixture.ts";
import { castPath, costumesPath, rolesPath, runningOrderPath } from "@/services/production.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { alexMorgan, captainHook, joBrown, samPatel } from "@/utils/casting.fixture.ts";
import { alexAsHook } from "@/utils/costumes.fixture.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";
import { outline, readDocx } from "@/utils/word/docx.fixture.ts";

// The Overview's Generate Costume Sheets button (production-costume-sheets FR9–FR11, FR14;
// ADR 0022). Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).

enableAutoUnmount(afterEach);

const alex: CastMember = { ...alexMorgan, section: "scouts", group: "1st Anytown" };
const jo: CastMember = { ...joBrown, section: "explorers", group: "Anytown Unit" };
const show = aRunningOrder([anItem("Opening Number")], [anItem("Finale")]);

/** The stand-in API: what it answers can change between the page loading and the export. */
let api: { costumes: Costume[]; costumesStatus: number };
let saved: SavedFile[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 12, 10, 0) });
  useLocalSignIn();
  api = { costumes: [alexAsHook], costumesStatus: 200 };
  saved = catchDownloads();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === costumesPath()) {
        return api.costumesStatus === 200
          ? json({ productionId: "2027", costumes: api.costumes })
          : new Response(null, { status: api.costumesStatus });
      }
      if (url === rolesPath()) return json({ productionId: "2027", roles: [captainHook(alex)] });
      if (url === castPath()) return json({ productionId: "2027", members: [alex, jo, samPatel] });
      if (url === runningOrderPath()) return json(show);
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

async function openOverview() {
  return (await openAppAt("/production/overview")).wrapper;
}

const generate = (wrapper: VueWrapper) => generateFrom(wrapper, "Generate Costume Sheets");

describe("Generate Costume Sheets", () => {
  it("sits between Generate Props List and Generate Mic Plot, for someone with no permissions", async () => {
    await signInAs([], "jo");
    const wrapper = await openOverview();

    expect(wrapper.findAll("main .view-bar button").map((b) => b.text())).toEqual([
      "Generate Props List",
      "Generate Costume Sheets",
      "Generate Mic Plot",
    ]);
  });

  it("downloads a Word document named for the production and the day, a sheet per person", async () => {
    await signInAs([], "jo");
    const wrapper = await openOverview();

    await generate(wrapper);

    expect(saved.map(({ name }) => name)).toEqual([
      "Gang Show 2027 costume sheets 2026-11-12.docx",
    ]);
    const names = outline(readDocx(await bytesOf(saved[0]?.file))).filter((line) =>
      line.startsWith("Heading2"),
    );
    expect(names).toEqual(["Heading2: Alex Morgan", "Heading2: Jo Brown", "Heading2: Sam Patel"]);
  });

  it("holds the costumes as saved when it's generated, not when the page loaded", async () => {
    const wrapper = await openOverview();
    api.costumes = [{ ...alexAsHook, fromWardrobe: "Blue coat" }];

    await generate(wrapper);

    const table = readDocx(await bytesOf(saved[0]?.file)).find((block) => block.kind === "table");
    expect(table?.kind === "table" ? table.rows[2]?.cells : undefined).toEqual([
      "1",
      "Opening Number",
      "✓(Captain Hook)",
      "Blue coat",
      "Black shoes",
    ]);
  });

  it("says the costume sheets were generated, and records the use", async () => {
    const wrapper = await openOverview();

    await generate(wrapper);

    expect(wrapper.get("[data-test=announcement]").text()).toBe("Costume sheets generated.");
    expect(exportUses()).toEqual([{ event: "export", export: "word-costume-sheets" }]);
  });

  it("says when they can't be made", async () => {
    const wrapper = await openOverview();
    api.costumesStatus = 500;

    await generate(wrapper);

    expect(wrapper.get("[data-test=costumes-error]").text()).toBe(
      "Couldn't generate the costume sheets. Try again.",
    );
  });
});
