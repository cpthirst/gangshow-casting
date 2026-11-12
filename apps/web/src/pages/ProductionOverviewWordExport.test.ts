import type { CastMember, Prop, Role } from "@app/shared";
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
  propsPath,
  rolesPath,
  runningOrderPath,
} from "@/services/production.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";
import { documentXml, readDocx } from "@/utils/word/docx.fixture.ts";

// The Production overview's Generate Props List button (production-props FR22, FR23; ADR 0022). Made-up
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
const sam = member(1, "Sam", "Taylor");
const kim = member(2, "Kim", "Lee");
const show = aRunningOrder([anItem("Pirate Sketch")], [anItem("Finale")]);
const captain: Role = {
  id: 1,
  itemId: "pirate-sketch",
  name: "Captain",
  size: "lead",
  castMemberIds: [sam.id],
  revision: 1,
};
const telescope: Prop = {
  id: 1,
  itemId: "pirate-sketch",
  name: "Telescope",
  quantity: 1,
  roleIds: [1],
  carrierIds: [],
};

/** The stand-in API: what it answers can change between the page loading and the export. */
let api: {
  cast: CastMember[];
  roles: Role[];
  propsStatus: number;
};
let saved: SavedFile[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 25, 10, 0) });
  useLocalSignIn();
  api = { cast: [sam, kim], roles: [captain], propsStatus: 200 };
  saved = catchDownloads();
  const json = (body: unknown) => new Response(JSON.stringify(body));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === propsPath()) {
        return api.propsStatus === 200
          ? json({ productionId: "2027", props: [telescope] })
          : new Response(null, { status: api.propsStatus });
      }
      if (url === departmentNotesPath("props")) return json({ productionId: "2027", notes: [] });
      if (url === rolesPath()) return json({ productionId: "2027", roles: api.roles });
      if (url === castPath()) return json({ productionId: "2027", members: api.cast });
      if (url === runningOrderPath()) return json(show);
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

const generate = (wrapper: VueWrapper) => generateFrom(wrapper, "Generate Props List");

describe("Generate Props List", () => {
  it("lets someone with no permissions download the props list as a Word document", async () => {
    await signInAs([], "jo");
    const wrapper = await openOverview();

    await generate(wrapper);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toMatch(/\.docx$/);
  });

  it("names the file for the production and the day, as the Item Overview is", async () => {
    const wrapper = await openOverview();

    await generate(wrapper);

    expect(saved.map(({ name }) => name)).toEqual(["Gang Show 2027 props list 2026-10-25.docx"]);
  });

  it("shows the cast as saved when it's generated, not when the page loaded", async () => {
    const wrapper = await openOverview();
    api.roles = [{ ...captain, castMemberIds: [kim.id] }];

    await generate(wrapper);

    const table = readDocx(await bytesOf(saved[0]?.file)).find((block) => block.kind === "table");
    expect(table?.kind === "table" ? table.rows[1]?.cells : undefined).toEqual([
      "Telescope",
      "1",
      "Captain",
      "Kim Lee",
    ]);
  });

  it("holds nothing about the cast beyond their names", async () => {
    const wrapper = await openOverview();

    await generate(wrapper);

    const xml = documentXml(await bytesOf(saved[0]?.file));
    expect(xml).toContain("Sam Taylor");
    for (const detail of ["Strong alto voice", "Confident on stage", "Made-up Explorer Unit"]) {
      expect(xml).not.toContain(detail);
    }
    expect(xml).not.toMatch(/explorers/i);
  });

  it("says the props list was generated, and records the use", async () => {
    const wrapper = await openOverview();

    await generate(wrapper);

    expect(wrapper.get("[data-test=announcement]").text()).toBe("Props list generated.");
    expect(exportUses()).toEqual([{ event: "export", export: "word-props-list" }]);
  });

  it("says when it can't be made", async () => {
    const wrapper = await openOverview();
    api.propsStatus = 500;

    await generate(wrapper);

    expect(wrapper.get("[data-test=props-error]").text()).toBe(
      "Couldn't generate the props list. Try again.",
    );
  });
});
