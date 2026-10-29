import {
  type ItemNote,
  type RunningOrder,
  SaveItemNoteRequest,
  type SceneryFile,
} from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "@/App.vue";
import { createAppRouter } from "@/router/index.ts";
import { downloadFrom, openFileTab } from "@/services/file-link.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";
import { RUNNING_ORDER_PATH } from "@/utils/running-order.ts";
import { SCENERY_NOTES_PATH, sceneryFileLinkPath, sceneryFilesPath } from "@/utils/scenery.ts";

// The browser's own new tabs and downloads, which happy-dom can't follow.
vi.mock("@/services/file-link.ts", () => ({ openFileTab: vi.fn(), downloadFrom: vi.fn() }));

enableAutoUnmount(afterEach);
// As on pnpm dev: everyone acts as an admin, unless a test signs someone in.
beforeEach(useLocalSignIn);
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  useLocalSignIn();
});

// Made-up items, in show order: Opening Number, Pirate Sketch | Finale.
const show = aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")], [anItem("Finale")]);

/** The stand-in API's short-lived link to a file. */
const linkTo = (name: string) => `https://files.example/${encodeURIComponent(name)}?signed`;

const json = (body: unknown) => new Response(JSON.stringify(body));

/** A stand-in API holding one saved running order (none if undefined), each item's files
 *  as file storage holds them now, read on every request, and any scenery notes. */
function apiHolds(
  order: RunningOrder | undefined,
  files: Record<string, SceneryFile[]> = {},
  notes: ItemNote[] = [],
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === RUNNING_ORDER_PATH) {
        return order ? json(order) : new Response(null, { status: 404 });
      }
      if (url === SCENERY_NOTES_PATH) return json({ productionId: "2027", notes });
      if (init?.method === "PUT" && url.endsWith("/scenery-notes")) {
        const { text, revision } = SaveItemNoteRequest.parse(JSON.parse(String(init.body)));
        const itemId = url.split("/").at(-2) ?? "";
        const saved = { itemId, text, revision: revision + 1 };
        notes.splice(0, notes.length, ...notes.filter((n) => n.itemId !== itemId), saved);
        return json(saved);
      }
      for (const [itemId, itemFiles] of Object.entries(files)) {
        if (url === sceneryFilesPath(itemId)) return json({ files: itemFiles });
        for (const { name } of itemFiles) {
          if (url === sceneryFileLinkPath(itemId, name)) return json({ url: linkTo(name) });
        }
      }
      if (url.includes("/scenery-file-link?")) return new Response(null, { status: 404 });
      if (url.endsWith("/scenery-files")) return json({ files: [] });
      if (url === "/api/usage") return new Response(null, { status: 204 });
      return json({ status: "ok", version: "dev" });
    }),
  );
}

// The whole app, so routing, the menu and the tab title are real.
async function openAppAt(path: string) {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return { wrapper, router };
}

const tiles = (wrapper: VueWrapper) =>
  wrapper.findAll("main [data-test=file]").map((tile) => ({
    name: tile.get("[data-test=name]").text(),
    size: tile.get("[data-test=size]").text(),
  }));

const OPENING_NUMBER = "/production/items/opening-number/scenery";

const openingNumberFiles = {
  "opening-number": [
    { name: "set-plan.pdf", size: 2_400_000 },
    { name: "Backdrop.png", size: 800_000 },
    { name: "build-list.xlsx", size: 40_000 },
  ],
};

describe("An item's Scenery page", () => {
  it("shows a tile for each of the item's files, by name, with its size", async () => {
    apiHolds(show, openingNumberFiles);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(wrapper.get("main h1").text()).toBe("Scenery: Opening Number");
    expect(tiles(wrapper)).toEqual([
      { name: "Backdrop.png", size: "800 KB" },
      { name: "build-list.xlsx", size: "40 KB" },
      { name: "set-plan.pdf", size: "2.4 MB" },
    ]);
    expect(wrapper.get("main").text()).not.toContain("Coming soon");
  });

  it("gives each tile a general file icon, hidden from screen readers", async () => {
    apiHolds(show, openingNumberFiles);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    const icons = wrapper.findAll("main [data-test=file] svg");
    expect(icons).toHaveLength(3);
    expect(icons.every((icon) => icon.classes().includes("fa-file"))).toBe(true);
    expect(icons.every((icon) => icon.attributes("aria-hidden") === "true")).toBe(true);
  });

  it("shows the names file storage holds each time the page opens", async () => {
    apiHolds(show, { "opening-number": [{ name: "set-plan.pdf", size: 10 }] });
    const first = await openAppAt(OPENING_NUMBER);
    expect(tiles(first.wrapper).map((tile) => tile.name)).toEqual(["set-plan.pdf"]);
    first.wrapper.unmount();

    // Renamed directly in file storage, outside the app.
    apiHolds(show, { "opening-number": [{ name: "set-plan-v2.pdf", size: 10 }] });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(tiles(wrapper).map((tile) => tile.name)).toEqual(["set-plan-v2.pdf"]);
  });

  it("says when the item has no files", async () => {
    apiHolds(show);
    const { wrapper } = await openAppAt("/production/items/finale/scenery");

    expect(wrapper.findAll("main [data-test=file]")).toEqual([]);
    expect(wrapper.get("[data-test=no-files]").text()).toBe("No scenery files for this item yet.");
  });

  it("shows only the item's own files, and follows Next to the next item's", async () => {
    apiHolds(show, {
      "opening-number": [{ name: "set-plan.pdf", size: 10 }],
      "pirate-sketch": [{ name: "ship.png", size: 10 }],
      finale: [{ name: "curtain.pdf", size: 10 }],
    });
    const { wrapper } = await openAppAt("/production/items/pirate-sketch/scenery");
    expect(tiles(wrapper).map((tile) => tile.name)).toEqual(["ship.png"]);

    await wrapper.get("main a[rel=next]").trigger("click");
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Scenery: Finale");
    expect(tiles(wrapper).map((tile) => tile.name)).toEqual(["curtain.pdf"]);
  });

  it("shows a name as text, never as markup", async () => {
    apiHolds(show, { "opening-number": [{ name: "<b>plan.pdf", size: 10 }] });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(tiles(wrapper).map((tile) => tile.name)).toEqual(["<b>plan.pdf"]);
    expect(wrapper.find("main [data-test=file] b").exists()).toBe(false);
  });

  it("shows the files to someone with no permissions, as to an admin", async () => {
    await signInAs([], "jo");
    apiHolds(show, openingNumberFiles);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(tiles(wrapper).map((tile) => tile.name)).toEqual([
      "Backdrop.png",
      "build-list.xlsx",
      "set-plan.pdf",
    ]);
  });

  it("goes back to the Overview, and steps to the previous and next items' Scenery pages", async () => {
    apiHolds(show);
    const { wrapper, router } = await openAppAt("/production/items/pirate-sketch/scenery");

    const steps = wrapper
      .findAll("main nav[aria-label='Item navigation'] a[rel]")
      .map((link) => [link.attributes("rel"), link.attributes("href")]);
    expect(steps).toEqual([
      ["prev", "/production/items/opening-number/scenery"],
      ["next", "/production/items/finale/scenery"],
    ]);

    await wrapper.get("main a.back-link").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/production/overview");
  });

  it("says an item that isn't in the running order wasn't found, with a link back", async () => {
    apiHolds(show);
    const { wrapper } = await openAppAt("/production/items/no-such-item/scenery");

    expect(wrapper.get("main h1").text()).toBe("Item not found");
    expect(wrapper.find("[data-test=no-files]").exists()).toBe(false);
    expect(wrapper.get("main a.back-link").attributes("href")).toBe("/production/overview");
  });

  it("reports a failed load of the files rather than no files", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === RUNNING_ORDER_PATH ? json(show) : new Response(null, { status: 500 }),
      ),
    );
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the item.");
    expect(wrapper.find("[data-test=no-files]").exists()).toBe(false);
  });

  it("tells someone with Casting only that they can view the scenery but not change it", async () => {
    await signInAs(["casting"], "sam");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(wrapper.get("[data-test=read-only]").text()).toBe(
      "You can view the scenery, but not change it: only Stage, Tech, Director and admins can.",
    );
  });

  it.each([
    [["stage"], "pat"],
    [["tech"], "lee"],
    [["director"], "dee"],
    [["admin"], "alex"],
  ])("shows %s no read-only line", async (groups, name) => {
    await signInAs(groups, name);
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(wrapper.get("main h1").text()).toBe("Scenery: Opening Number");
    expect(wrapper.find("[data-test=read-only]").exists()).toBe(false);
  });

  it("has a help button beside the item's name, which opens the Scenery page's help", async () => {
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    const row = wrapper.get("main .page-title-row");
    expect(row.get("h1").text()).toBe("Scenery: Opening Number");
    await row.get("button[aria-label='Help for this item']").trigger("click");

    const names = wrapper.findAll("dialog [data-test=help-name]").map((name) => name.text());
    expect(names).toEqual(["All items", "Previous and Next", "File tiles", "Scenery notes"]);
  });
});

describe("Scenery notes", () => {
  const notesSection = (wrapper: VueWrapper) =>
    wrapper.get("section[aria-labelledby=notes-heading]");

  it("saves scenery notes for Tech, and shows them on the next visit", async () => {
    await signInAs(["tech"], "lee");
    apiHolds(show);
    const first = await openAppAt(OPENING_NUMBER);
    expect(notesSection(first.wrapper).get("h2").text()).toBe("Scenery notes");

    await notesSection(first.wrapper)
      .get("textarea")
      .setValue("Fly the cloud in after the blackout");
    await notesSection(first.wrapper).get("form").trigger("submit");
    await flushPromises();
    const puts = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(puts.map(([url]) => url)).toEqual([
      "/api/productions/2027/items/opening-number/scenery-notes",
    ]);
    first.wrapper.unmount();

    const { wrapper } = await openAppAt(OPENING_NUMBER);
    expect(notesSection(wrapper).get<HTMLTextAreaElement>("textarea").element.value).toBe(
      "Fly the cloud in after the blackout",
    );
  });

  it("shows scenery notes to someone with Casting only, with nothing to change them", async () => {
    await signInAs(["casting"], "sam");
    apiHolds(show, {}, [{ itemId: "opening-number", text: "Cloud", revision: 1 }]);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(notesSection(wrapper).get("[data-test=notes-text]").text()).toBe("Cloud");
    expect(notesSection(wrapper).find("textarea").exists()).toBe(false);
  });
});

describe("Opening and downloading a scenery file", () => {
  const tab = { show: vi.fn(), close: vi.fn() };
  beforeEach(() => {
    vi.mocked(openFileTab).mockReset().mockReturnValue(tab);
    vi.mocked(downloadFrom).mockReset();
    tab.show.mockReset();
    tab.close.mockReset();
  });

  const tileFor = (wrapper: VueWrapper, name: string) => {
    const tile = wrapper
      .findAll("main [data-test=file]")
      .find((found) => found.get("[data-test=name]").text() === name);
    if (!tile) throw new Error(`no tile for ${name}`);
    return tile.get("button");
  };

  async function choose(wrapper: VueWrapper, name: string) {
    await tileFor(wrapper, name).trigger("click");
    await flushPromises();
  }

  const linkRequests = () =>
    vi
      .mocked(fetch)
      .mock.calls.map(([url]) => String(url))
      .filter((url) => url.includes("/scenery-file-link?"));

  it("opens a PDF in a new tab, opened on the click, leaving the page open", async () => {
    apiHolds(show, openingNumberFiles);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await choose(wrapper, "set-plan.pdf");

    expect(linkRequests()).toEqual([sceneryFileLinkPath("opening-number", "set-plan.pdf")]);
    expect(tab.show).toHaveBeenCalledWith(linkTo("set-plan.pdf"));
    // Opened before the API answered, so a phone doesn't block it as a pop-up.
    const linkCall = vi.mocked(fetch).mock.calls.findIndex(([url]) => String(url).includes("link"));
    expect(vi.mocked(openFileTab).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(fetch).mock.invocationCallOrder[linkCall] ?? 0,
    );
    expect(downloadFrom).not.toHaveBeenCalled();
    expect(wrapper.get("main h1").text()).toBe("Scenery: Opening Number");
  });

  it("downloads a spreadsheet, opening no tab", async () => {
    apiHolds(show, openingNumberFiles);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await choose(wrapper, "build-list.xlsx");

    expect(downloadFrom).toHaveBeenCalledWith(linkTo("build-list.xlsx"));
    expect(openFileTab).not.toHaveBeenCalled();
  });

  it("asks for a file renamed in storage by its new name", async () => {
    apiHolds(show, { "opening-number": [{ name: "build-list-v2.xlsx", size: 10 }] });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await choose(wrapper, "build-list-v2.xlsx");

    expect(linkRequests()).toEqual([sceneryFileLinkPath("opening-number", "build-list-v2.xlsx")]);
    expect(downloadFrom).toHaveBeenCalledWith(linkTo("build-list-v2.xlsx"));
  });

  it("lets someone with no permissions open and download files, as an admin can", async () => {
    await signInAs([], "jo");
    apiHolds(show, openingNumberFiles);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await choose(wrapper, "set-plan.pdf");
    await choose(wrapper, "build-list.xlsx");

    expect(tab.show).toHaveBeenCalledWith(linkTo("set-plan.pdf"));
    expect(downloadFrom).toHaveBeenCalledWith(linkTo("build-list.xlsx"));
  });

  it.each(["notes.html", "plan.svg"])("only downloads %s, which could run script", async (name) => {
    apiHolds(show, { "opening-number": [{ name, size: 10 }] });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await choose(wrapper, name);

    expect(downloadFrom).toHaveBeenCalledWith(linkTo(name));
    expect(openFileTab).not.toHaveBeenCalled();
  });

  it("says a file deleted since the page loaded isn't there any more, and refreshes the grid", async () => {
    const held = { "opening-number": [...openingNumberFiles["opening-number"]] };
    apiHolds(show, held);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    // Deleted from file storage, outside the app.
    held["opening-number"] = held["opening-number"].filter((f) => f.name !== "set-plan.pdf");

    await choose(wrapper, "set-plan.pdf");

    expect(wrapper.get("main [data-test=file-problem]").text()).toBe(
      "set-plan.pdf isn't there any more.",
    );
    expect(wrapper.get("main [data-test=file-problem]").attributes("role")).toBe("alert");
    expect(wrapper.get("main [data-test=file-problem]").classes()).toContain("notice");
    expect(tiles(wrapper).map((tile) => tile.name)).toEqual(["Backdrop.png", "build-list.xlsx"]);
    expect(tab.close).toHaveBeenCalled();
    expect(tab.show).not.toHaveBeenCalled();
  });

  it.each([
    ["set-plan.pdf", "Couldn't open set-plan.pdf. Try again."],
    ["build-list.xlsx", "Couldn't download build-list.xlsx. Try again."],
  ])("says %s couldn't be opened or downloaded when the API fails", async (name, message) => {
    apiHolds(show, openingNumberFiles);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const stand = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      String(url).includes("/scenery-file-link?")
        ? new Response(null, { status: 500 })
        : (stand?.(url, init) ?? new Response(null, { status: 500 })),
    );

    await choose(wrapper, name);

    expect(wrapper.get("main [data-test=file-problem]").text()).toBe(message);
    // Only a file that opens has a tab waiting for it, which mustn't be left blank.
    expect(tab.close).toHaveBeenCalledTimes(name === "set-plan.pdf" ? 1 : 0);
    expect(tab.show).not.toHaveBeenCalled();
    expect(downloadFrom).not.toHaveBeenCalled();
  });

  it("names each tile for what choosing it does, and the file's type", async () => {
    apiHolds(show, {
      "opening-number": [
        { name: "set-plan.pdf", size: 10 },
        { name: "build-list.xlsx", size: 10 },
        { name: "notes", size: 10 },
      ],
    });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    const names = wrapper
      .findAll("main [data-test=file] button")
      .map((b) => b.attributes("aria-label"));
    expect(names).toEqual([
      "Download build-list.xlsx, XLSX file",
      "Download notes",
      "Open set-plan.pdf, PDF file",
    ]);
  });
});
