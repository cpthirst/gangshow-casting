import { enableAutoUnmount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { json, openAppAt } from "@/app.fixture.ts";
import {
  catchDownloads,
  exportUses,
  generateFrom,
  type SavedFile,
} from "@/services/export-file.fixture.ts";
import {
  castPath,
  costumesPath,
  micPlotPath,
  propsPath,
  rolesPath,
  runningOrderPath,
} from "@/services/production.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { icons } from "@/utils/icons.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";

// What the Overview's export buttons share: one at a time, busy while it runs, focus back
// after, and ready to try again when one fails (production-props FR22, production-mics FR14,
// production-costume-sheets FR9). Each export's file and wording are tested in its own file.

enableAutoUnmount(afterEach);

const exports = [
  {
    label: "Generate Props List",
    path: propsPath,
    data: { props: [] },
    format: { icon: icons.exportWord, buttonClass: "word-export-button" },
  },
  {
    label: "Generate Costume Sheets",
    path: costumesPath,
    data: { costumes: [] },
    format: { icon: icons.exportWord, buttonClass: "word-export-button" },
  },
  {
    label: "Generate Mic Plot",
    path: micPlotPath,
    data: { items: [] },
    format: { icon: icons.exportFile, buttonClass: "excel-export-button" },
  },
];

/** The stand-in API: an export's own data can fail, or be held back until released. */
let api: { failing?: string; held?: { path: string; until: Promise<void> } };
let saved: SavedFile[];

beforeEach(() => {
  useLocalSignIn();
  api = {};
  saved = catchDownloads();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === api.held?.path) await api.held.until;
      if (url === api.failing) return new Response(null, { status: 500 });
      const own = exports.find(({ path }) => path() === url);
      if (own) return json({ productionId: "2027", ...own.data });
      if (url === rolesPath()) return json({ productionId: "2027", roles: [] });
      if (url === castPath()) return json({ productionId: "2027", members: [] });
      if (url === runningOrderPath()) return json(aRunningOrder([anItem("Opening")]));
      if (url.endsWith("-notes")) return json({ productionId: "2027", notes: [] });
      return json({ status: "ok", version: "dev" });
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useLocalSignIn();
  document.body.innerHTML = "";
});

const openOverview = async () => (await openAppAt("/production/overview")).wrapper;

describe.each(exports)("$label", ({ label, path, format }) => {
  const buttonOf = (wrapper: Awaited<ReturnType<typeof openOverview>>) =>
    wrapper.findAll("main .view-bar button").find((button) => button.text() === label);

  it("has its format's colour and file icon", async () => {
    const button = buttonOf(await openOverview());

    expect(button?.classes()).toContain(format.buttonClass);
    expect(button?.get("svg").attributes("data-icon")).toBe(format.icon.iconName);
  });

  it("is busy while it runs, starts nothing more, then has focus back", async () => {
    const wrapper = await openOverview();
    let release = () => {};
    api.held = { path: path(), until: new Promise((resolve) => (release = resolve)) };

    const button = buttonOf(wrapper);
    await button?.trigger("click");
    const busy = wrapper.findAll("main .view-bar button").map((b) => b.attributes("disabled"));
    await button?.trigger("click");
    release();
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    await vi.waitFor(() => expect(button?.attributes("disabled")).toBeUndefined());

    // Every export waits while one runs, as they share one way of making a file.
    expect(busy).toEqual(["", "", ""]);
    expect(saved).toHaveLength(1);
    // Back on the button, as a disabled button drops keyboard focus.
    expect(document.activeElement).toBe(button?.element);
  });

  it("saves and records nothing when it fails, says so, and works when tried again", async () => {
    const wrapper = await openOverview();
    api.failing = path();

    await generateFrom(wrapper, label);

    expect(saved).toEqual([]);
    expect(exportUses()).toEqual([]);
    expect(wrapper.findAll("main [data-test$=-error]")).toHaveLength(1);

    delete api.failing;
    await generateFrom(wrapper, label);

    expect(wrapper.findAll("main [data-test$=-error]")).toHaveLength(0);
    expect(saved).toHaveLength(1);
  });
});
