import {
  type ItemNote,
  MAX_SCENERY_FILE_BYTES,
  type RunningOrder,
  SaveItemNoteRequest,
  type SceneryFile,
  SceneryUploadRequest,
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
import {
  SCENERY_NOTES_PATH,
  sceneryFileLinkPath,
  sceneryFilePath,
  sceneryFilesPath,
  sceneryUploadsPath,
} from "@/utils/scenery.ts";

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

/** Where the stand-in file storage takes uploads, apart from the API, as the bucket is. */
const STORAGE = "https://files.example/";

/** The browser's XMLHttpRequest, which uploads use for their progress. happy-dom's can't
 *  reach the stand-in file storage, so this one hands each request to the stand-in fetch, and
 *  a test can report how much of the latest one has gone. */
class StandInXhr extends EventTarget {
  static latest: StandInXhr | undefined;
  readonly upload = new EventTarget();
  status = 0;
  private method = "";
  private url = "";
  private headers: Record<string, string> | undefined;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers = { ...this.headers, [name]: value };
  }

  send(body: FormData) {
    StandInXhr.latest = this;
    const init = { method: this.method, body, ...(this.headers ? { headers: this.headers } : {}) };
    fetch(this.url, init)
      .then((res) => {
        this.status = res.status;
      })
      .catch(() => {
        this.status = 0;
      })
      .finally(() => this.dispatchEvent(new Event("loadend")));
  }

  /** As the browser reports how much of the request's body has gone. */
  sent(loaded: number, total: number) {
    this.upload.dispatchEvent(
      new ProgressEvent("progress", { lengthComputable: true, loaded, total }),
    );
  }
}

/** A stand-in API holding one saved running order (none if undefined), each item's files
 *  as file storage holds them now, read on every request and changed by deletes, and any
 *  scenery notes. */
function apiHolds(
  order: RunningOrder | undefined,
  files: Record<string, SceneryFile[]> = {},
  notes: ItemNote[] = [],
) {
  // The item's files, held from now on, as an upload's first file starts them.
  const filesOf = (itemId: string) => {
    const held = files[itemId] ?? [];
    files[itemId] = held;
    return held;
  };
  vi.stubGlobal("XMLHttpRequest", StandInXhr);
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
      // Hands back a form for file storage, naming the file and its size in its key's place.
      if (init?.method === "POST" && url.endsWith("/scenery-uploads")) {
        const itemId = url.split("/").at(-2) ?? "";
        const { name, size, replace } = SceneryUploadRequest.parse(JSON.parse(String(init.body)));
        const itemFiles = filesOf(itemId);
        if (!replace && itemFiles.some((file) => file.name === name)) {
          return new Response(null, { status: 409 });
        }
        return json({ url: STORAGE, fields: { key: JSON.stringify({ itemId, name, size }) } });
      }
      if (url === STORAGE && init?.body instanceof FormData) {
        const { itemId, name, size } = JSON.parse(String(init.body.get("key")));
        const itemFiles = filesOf(itemId);
        itemFiles.splice(0, itemFiles.length, ...itemFiles.filter((f) => f.name !== name), {
          name,
          size,
        });
        return new Response(null, { status: 204 });
      }
      for (const [itemId, itemFiles] of Object.entries(files)) {
        if (init?.method === "DELETE") {
          const at = itemFiles.findIndex(({ name }) => url === sceneryFilePath(itemId, name));
          if (at < 0) continue;
          itemFiles.splice(at, 1);
          return new Response(null, { status: 204 });
        }
        if (url === sceneryFilesPath(itemId)) return json({ files: itemFiles });
        for (const { name } of itemFiles) {
          if (url === sceneryFileLinkPath(itemId, name)) return json({ url: linkTo(name) });
        }
      }
      if (url.includes("/scenery-file-link?") || init?.method === "DELETE") {
        return new Response(null, { status: 404 });
      }
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

const rows = (wrapper: VueWrapper) =>
  wrapper.findAll("main [data-test=file]").map((row) => ({
    name: row.get("[data-test=name]").text(),
    size: row.get("[data-test=size]").text(),
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
  it("shows a row for each of the item's files, by name, with its size", async () => {
    apiHolds(show, openingNumberFiles);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(wrapper.get("main h1").text()).toBe("Scenery: Opening Number");
    expect(rows(wrapper)).toEqual([
      { name: "Backdrop.png", size: "800 KB" },
      { name: "build-list.xlsx", size: "40 KB" },
      { name: "set-plan.pdf", size: "2.4 MB" },
    ]);
    expect(wrapper.get("main").text()).not.toContain("Coming soon");
  });

  it("gives each row its type's icon, hidden from screen readers", async () => {
    apiHolds(show, {
      "opening-number": [
        { name: "plan.pdf", size: 10 },
        { name: "notes.docx", size: 10 },
        { name: "build.xlsx", size: 10 },
        { name: "pitch.pptx", size: 10 },
        { name: "PHOTO.JPEG", size: 10 },
        { name: "model.skp", size: 10 },
        { name: "readme", size: 10 },
      ],
    });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    const icons = wrapper.findAll("main [data-test=file] .file-icon");
    // Sorted by name: build, model, notes, PHOTO, pitch, plan, readme.
    expect(icons.map((icon) => icon.classes().find((name) => name.startsWith("fa-file")))).toEqual([
      "fa-file-excel",
      "fa-file",
      "fa-file-word",
      "fa-file-image",
      "fa-file-powerpoint",
      "fa-file-pdf",
      "fa-file",
    ]);
    expect(icons.every((icon) => icon.attributes("aria-hidden") === "true")).toBe(true);
  });

  it("shows the names file storage holds each time the page opens", async () => {
    apiHolds(show, { "opening-number": [{ name: "set-plan.pdf", size: 10 }] });
    const first = await openAppAt(OPENING_NUMBER);
    expect(rows(first.wrapper).map((row) => row.name)).toEqual(["set-plan.pdf"]);
    first.wrapper.unmount();

    // Renamed directly in file storage, outside the app.
    apiHolds(show, { "opening-number": [{ name: "set-plan-v2.pdf", size: 10 }] });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(rows(wrapper).map((row) => row.name)).toEqual(["set-plan-v2.pdf"]);
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
    expect(rows(wrapper).map((row) => row.name)).toEqual(["ship.png"]);

    await wrapper.get("main a[rel=next]").trigger("click");
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Scenery: Finale");
    expect(rows(wrapper).map((row) => row.name)).toEqual(["curtain.pdf"]);
  });

  it("shows a name as text, never as markup", async () => {
    apiHolds(show, { "opening-number": [{ name: "<b>plan.pdf", size: 10 }] });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(rows(wrapper).map((row) => row.name)).toEqual(["<b>plan.pdf"]);
    expect(wrapper.find("main [data-test=file] b").exists()).toBe(false);
  });

  it("shows the files to someone with no permissions, as to an admin", async () => {
    await signInAs([], "jo");
    apiHolds(show, openingNumberFiles);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(rows(wrapper).map((row) => row.name)).toEqual([
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
    expect(names).toEqual([
      "All items",
      "Previous and Next",
      "Files",
      "Add a file",
      "Scenery notes",
    ]);
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

  const rowFor = (wrapper: VueWrapper, name: string) => {
    const row = wrapper
      .findAll("main [data-test=file]")
      .find((found) => found.get("[data-test=name]").text() === name);
    if (!row) throw new Error(`no row for ${name}`);
    return row.get(".file-open");
  };

  async function choose(wrapper: VueWrapper, name: string) {
    await rowFor(wrapper, name).trigger("click");
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
    expect(rows(wrapper).map((row) => row.name)).toEqual(["Backdrop.png", "build-list.xlsx"]);
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

  it("names each file for what choosing it does, and the file's type", async () => {
    apiHolds(show, {
      "opening-number": [
        { name: "set-plan.pdf", size: 10 },
        { name: "build-list.xlsx", size: 10 },
        { name: "notes", size: 10 },
      ],
    });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    const names = wrapper
      .findAll("main [data-test=file] .file-open")
      .map((b) => b.attributes("aria-label"));
    expect(names).toEqual([
      "Download build-list.xlsx, XLSX file",
      "Download notes",
      "Open set-plan.pdf, PDF file",
    ]);
  });
});

describe("Deleting a scenery file", () => {
  const QUESTION = "Remove set-plan.pdf? This can't be undone.";
  // Fresh copies, as deletes change what the stand-in API holds.
  const heldFiles = () => ({ "opening-number": [...openingNumberFiles["opening-number"]] });

  const trashFor = (wrapper: VueWrapper, name: string) => {
    const row = wrapper
      .findAll("main [data-test=file]")
      .find((found) => found.get("[data-test=name]").text() === name);
    if (!row) throw new Error(`no row for ${name}`);
    return row.get("[data-test=delete]");
  };

  async function trash(wrapper: VueWrapper, name: string, confirmed: boolean) {
    const confirm = vi.fn(() => confirmed);
    vi.stubGlobal("confirm", confirm);
    await trashFor(wrapper, name).trigger("click");
    await flushPromises();
    return confirm;
  }

  const deletes = () =>
    vi
      .mocked(fetch)
      .mock.calls.filter(([, init]) => init?.method === "DELETE")
      .map(([url]) => String(url));

  it.each([
    [["stage"], "pat"],
    [["tech"], "lee"],
    [["director"], "dee"],
    [["admin"], "alex"],
  ])("gives %s a trash icon on every row", async (groups, name) => {
    await signInAs(groups, name);
    apiHolds(show, openingNumberFiles);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(wrapper.findAll("main [data-test=file] [data-test=delete]")).toHaveLength(3);
  });

  it("shows each file as a row: the trash icon first, then its type icon, then its name", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show, openingNumberFiles);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    const row = wrapper.get("main [data-test=file]");
    expect(row.classes()).toContain("role-card");
    const parts = row.findAll("[data-test=delete], .file-icon, [data-test=name]");
    expect(parts.map((part) => part.attributes("data-test") ?? "icon")).toEqual([
      "delete",
      "icon",
      "name",
    ]);
  });

  it("asks to confirm, then deletes the file and its row for pat, with Stage", async () => {
    await signInAs(["stage"], "pat");
    const held = heldFiles();
    apiHolds(show, held);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    const confirm = await trash(wrapper, "set-plan.pdf", true);

    expect(confirm).toHaveBeenCalledWith(QUESTION);
    expect(deletes()).toEqual([sceneryFilePath("opening-number", "set-plan.pdf")]);
    expect(rows(wrapper).map((row) => row.name)).toEqual(["Backdrop.png", "build-list.xlsx"]);
    expect(held["opening-number"].map((file) => file.name)).not.toContain("set-plan.pdf");
  });

  it("keeps the file when pat cancels", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show, heldFiles());
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    const confirm = await trash(wrapper, "set-plan.pdf", false);

    expect(confirm).toHaveBeenCalledWith(QUESTION);
    expect(deletes()).toEqual([]);
    expect(rows(wrapper).map((row) => row.name)).toContain("set-plan.pdf");
  });

  it("gives sam, with Casting only, no trash icon", async () => {
    await signInAs(["casting"], "sam");
    apiHolds(show, openingNumberFiles);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(rows(wrapper)).toHaveLength(3);
    expect(wrapper.find("main [data-test=delete]").exists()).toBe(false);
  });

  it("says a file deleted in another browser is gone, and its row goes", async () => {
    await signInAs(["stage"], "pat");
    const held = heldFiles();
    apiHolds(show, held);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    // Deleted in another browser after the page loaded.
    held["opening-number"] = held["opening-number"].filter((f) => f.name !== "set-plan.pdf");

    await trash(wrapper, "set-plan.pdf", true);

    expect(wrapper.get("main [data-test=file-problem]").text()).toBe(
      "set-plan.pdf isn't there any more.",
    );
    expect(rows(wrapper).map((row) => row.name)).toEqual(["Backdrop.png", "build-list.xlsx"]);
  });

  it("says a delete that failed didn't happen, keeping the row", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show, heldFiles());
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const stand = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      init?.method === "DELETE"
        ? new Response(null, { status: 500 })
        : (stand?.(url, init) ?? new Response(null, { status: 500 })),
    );

    await trash(wrapper, "set-plan.pdf", true);

    expect(wrapper.get("main [data-test=file-problem]").text()).toBe(
      "Couldn't remove set-plan.pdf. Try again.",
    );
    expect(rows(wrapper).map((row) => row.name)).toContain("set-plan.pdf");
  });

  it("names each trash icon for its file, for screen readers", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show, openingNumberFiles);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(trashFor(wrapper, "set-plan.pdf").attributes("aria-label")).toBe("Remove set-plan.pdf");
    expect(trashFor(wrapper, "set-plan.pdf").attributes("type")).toBe("button");
  });
});

/** A made-up file, of the size given, as the browser's file picker hands it over. */
function aFile(name: string, size = 1_000) {
  const file = new File(["made-up"], name);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

// As the file picker does once someone chooses a file.
async function choose(wrapper: VueWrapper, file: File) {
  const input = wrapper.get("main [data-test=upload-input]");
  Object.defineProperty(input.element, "files", { value: [file], configurable: true });
  await input.trigger("change");
  await flushPromises();
}

const calls = (match: (url: string, init?: RequestInit) => boolean) =>
  vi.mocked(fetch).mock.calls.filter(([url, init]) => match(String(url), init));
const uploadRequests = () =>
  calls((url, init) => init?.method === "POST" && url.endsWith("/scenery-uploads"));
const storageRequests = () => calls((url) => url === STORAGE);
const problem = (wrapper: VueWrapper) => wrapper.get("main [data-test=file-problem]").text();

/** Holds file storage's answer to uploads until the test lets them go, as a big file takes a
 *  while on a slow connection. */
function holdStorage() {
  const stand = vi.mocked(fetch).getMockImplementation();
  const waiting: (() => void)[] = [];
  vi.mocked(fetch).mockImplementation(async (url, init) => {
    if (url === STORAGE) await new Promise<void>((resolve) => waiting.push(resolve));
    return stand?.(url, init) ?? new Response(null, { status: 500 });
  });
  return () => {
    for (const release of waiting) release();
  };
}

/** Drops the connection to file storage for the next upload only. */
function failStorageOnce() {
  const stand = vi.mocked(fetch).getMockImplementation();
  let dropped = false;
  vi.mocked(fetch).mockImplementation(async (url, init) => {
    if (url === STORAGE && !dropped) {
      dropped = true;
      throw new TypeError("Failed to fetch");
    }
    return stand?.(url, init) ?? new Response(null, { status: 500 });
  });
}

/** Answers the replace confirm as pat would. */
function answerReplace(confirmed: boolean) {
  const confirm = vi.fn(() => confirmed);
  vi.stubGlobal("confirm", confirm);
  return confirm;
}

describe("Uploading a scenery file", () => {
  it.each([
    [["stage"], "pat"],
    [["tech"], "lee"],
    [["director"], "dee"],
    [["admin"], "alex"],
  ])("keeps a file %s uploads, and shows its row in name order", async (groups, name) => {
    await signInAs(groups, name);
    const held = { "opening-number": [{ name: "set-plan.pdf", size: 2_400_000 }] };
    apiHolds(show, held);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await choose(wrapper, aFile("Backdrop.png", 800_000));

    expect(held["opening-number"]).toContainEqual({ name: "Backdrop.png", size: 800_000 });
    expect(rows(wrapper)).toEqual([
      { name: "Backdrop.png", size: "800 KB" },
      { name: "set-plan.pdf", size: "2.4 MB" },
    ]);
  });

  it("asks the API where to send the file by its name as chosen, and its size", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await choose(wrapper, aFile("Set Plan (Act 1).pdf", 2_400_000));

    const [[url, init] = []] = uploadRequests();
    expect(url).toBe(sceneryUploadsPath("opening-number"));
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Set Plan (Act 1).pdf",
      size: 2_400_000,
    });
    expect(rows(wrapper).map((row) => row.name)).toEqual(["Set Plan (Act 1).pdf"]);
  });

  it("sends the file straight to file storage, after its form's fields, without the sign-in token", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const file = aFile("set-plan.pdf");

    await choose(wrapper, file);

    const [[, init] = []] = storageRequests();
    expect(init?.method).toBe("POST");
    expect(init?.headers).toBeUndefined();
    const form = init?.body;
    if (!(form instanceof FormData)) throw new Error("expected a form");
    // File storage reads the fields first and the file last.
    expect([...form.keys()]).toEqual(["key", "file"]);
    expect(form.get("file")).toBeInstanceOf(File);
  });

  it("says on the upload area that it's for scenery and set images only", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(wrapper.get("main [data-test=upload-area]").text()).toContain(
      "Scenery and set images only: no photos of cast members.",
    );
  });

  it("opens the file picker from a button, which a keyboard reaches", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const input = wrapper.get("main [data-test=upload-input]");
    if (!(input.element instanceof HTMLInputElement)) throw new Error("expected a file input");
    const picker = vi.spyOn(input.element, "click");

    const button = wrapper.get("main [data-test=upload]");
    await button.trigger("click");

    expect(button.element.tagName).toBe("BUTTON");
    expect(button.attributes("type")).toBe("button");
    expect(button.text()).toBe("Add a file");
    expect(picker).toHaveBeenCalled();
    // The button is the one stop for a keyboard: the picker's own input is skipped.
    expect(input.attributes("tabindex")).toBe("-1");
  });

  it("gives the button back its focus once an upload ends, so a keyboard keeps its place", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const button = wrapper.get("main [data-test=upload]");

    await choose(wrapper, aFile("set-plan.pdf"));

    expect(document.activeElement).toBe(button.element);
  });

  it("uploads a file of exactly 100 MB", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await choose(wrapper, aFile("rig.mov", MAX_SCENERY_FILE_BYTES));

    expect(rows(wrapper)).toEqual([{ name: "rig.mov", size: "100 MB" }]);
  });

  it("refuses a file over 100 MB, saying so, without asking the API", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await choose(wrapper, aFile("rig.mov", 120_000_000));

    expect(problem(wrapper)).toBe("rig.mov is over 100 MB, so it wasn't uploaded.");
    expect(uploadRequests()).toEqual([]);
    expect(rows(wrapper)).toEqual([]);
  });

  it.each([
    [["casting"], "sam"],
    [[], "jo"],
  ])("gives %s no upload area", async (groups, name) => {
    await signInAs(groups, name);
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(wrapper.find("main [data-test=upload-area]").exists()).toBe(false);
  });

  it("says an upload whose connection dropped wasn't uploaded, and shows no row for it", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const stand = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (url === STORAGE) throw new TypeError("Failed to fetch");
      return stand?.(url, init) ?? new Response(null, { status: 500 });
    });

    await choose(wrapper, aFile("set-plan.pdf"));

    expect(problem(wrapper)).toBe(
      "set-plan.pdf wasn't uploaded. Check your connection and try again.",
    );
    expect(rows(wrapper)).toEqual([]);
  });

  it("says an upload file storage refused wasn't uploaded", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const stand = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      url === STORAGE
        ? new Response(null, { status: 400 })
        : (stand?.(url, init) ?? new Response(null, { status: 500 })),
    );

    await choose(wrapper, aFile("set-plan.pdf"));

    expect(problem(wrapper)).toBe(
      "set-plan.pdf wasn't uploaded. Check your connection and try again.",
    );
    expect(rows(wrapper)).toEqual([]);
  });

  it("tries a failed upload again with the same file, without choosing it again", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    failStorageOnce();
    const appended = vi.spyOn(FormData.prototype, "append");
    const file = aFile("set-plan.pdf", 5_000);
    await choose(wrapper, file);
    const again = wrapper.get("main [data-test=try-again]");
    expect(again.text()).toBe("Try again");
    expect(again.attributes("type")).toBe("button");

    await again.trigger("click");
    await flushPromises();

    expect(uploadRequests()).toHaveLength(2);
    // The very file chosen the first time, not a copy: a real browser's form refuses anything
    // else. happy-dom's form hands back copies, so look at what the page put in it.
    const sentFiles = appended.mock.calls.filter(([field]) => field === "file");
    expect(sentFiles).toHaveLength(2);
    expect(sentFiles[1]?.[1]).toBe(file);
    expect(rows(wrapper)).toEqual([{ name: "set-plan.pdf", size: "5 KB" }]);
    expect(wrapper.find("main [data-test=file-problem]").exists()).toBe(false);
    expect(wrapper.find("main [data-test=try-again]").exists()).toBe(false);
  });

  it("tries a failed replace again as a replace, without asking again", async () => {
    await signInAs(["stage"], "pat");
    const held = { "opening-number": [{ name: "set-plan.pdf", size: 2_400_000 }] };
    apiHolds(show, held);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const confirm = answerReplace(true);
    failStorageOnce();
    await choose(wrapper, aFile("set-plan.pdf", 5_000));

    await wrapper.get("main [data-test=try-again]").trigger("click");
    await flushPromises();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(uploadRequests().map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { name: "set-plan.pdf", size: 5_000, replace: true },
      { name: "set-plan.pdf", size: 5_000, replace: true },
    ]);
    expect(held["opening-number"]).toEqual([{ name: "set-plan.pdf", size: 5_000 }]);
  });
});

describe("Upload progress", () => {
  it("shows how much of a file has uploaded as it goes, then its row", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const release = holdStorage();

    await choose(wrapper, aFile("set-plan.pdf", 40_000_000));
    StandInXhr.latest?.sent(12_000_000, 40_000_000);
    await flushPromises();

    const progress = wrapper.get("main [data-test=upload-progress]");
    expect(progress.text()).toBe("Uploading set-plan.pdf: 12 MB of 40 MB");
    const bar = progress.get("progress").element;
    if (!(bar instanceof HTMLProgressElement)) throw new Error("expected a progress bar");
    expect(bar.value / bar.max).toBe(0.3);

    release();
    await flushPromises();

    expect(rows(wrapper)).toEqual([{ name: "set-plan.pdf", size: "40 MB" }]);
    expect(wrapper.find("main [data-test=upload-progress]").exists()).toBe(false);
  });

  it("announces an upload's start and end, but not each step between", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    // There before anything is said in it, so screen readers hear what is.
    const status = wrapper.get("main [data-test=upload-status]");
    expect(status.attributes("role")).toBe("status");
    expect(status.text()).toBe("");
    const release = holdStorage();

    await choose(wrapper, aFile("set-plan.pdf", 40_000_000));
    expect(status.text()).toBe("Uploading set-plan.pdf");
    StandInXhr.latest?.sent(12_000_000, 40_000_000);
    await flushPromises();
    expect(status.text()).toBe("Uploading set-plan.pdf");
    // The changing amount is shown, but not in a live region.
    expect(wrapper.find("main [data-test=upload-progress][role], main [aria-live]").exists()).toBe(
      false,
    );

    release();
    await flushPromises();
    expect(status.text()).toBe("set-plan.pdf uploaded");
  });

  it("announces a failed upload as an alert, leaving nothing said as status", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const stand = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      url === STORAGE
        ? new Response(null, { status: 400 })
        : (stand?.(url, init) ?? new Response(null, { status: 500 })),
    );

    await choose(wrapper, aFile("set-plan.pdf"));

    expect(wrapper.get("main [data-test=file-problem]").attributes("role")).toBe("alert");
    expect(wrapper.get("main [data-test=upload-status]").text()).toBe("");
  });

  it("downloads another file while an upload carries on", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show, { "opening-number": [{ name: "build-list.xlsx", size: 40_000 }] });
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    vi.mocked(downloadFrom).mockReset();
    const release = holdStorage();
    await choose(wrapper, aFile("set-plan.pdf", 40_000_000));

    await wrapper.get("main [data-test=file] .file-open").trigger("click");
    await flushPromises();

    expect(downloadFrom).toHaveBeenCalledWith(linkTo("build-list.xlsx"));
    expect(wrapper.find("main [data-test=upload-progress]").exists()).toBe(true);
    release();
    await flushPromises();
    expect(rows(wrapper).map((row) => row.name)).toEqual(["build-list.xlsx", "set-plan.pdf"]);
  });
});

describe("Replacing a scenery file", () => {
  const REPLACE = "Replace set-plan.pdf? The old copy can't be brought back.";
  const heldSetPlan = () => ({ "opening-number": [{ name: "set-plan.pdf", size: 2_400_000 }] });

  it("asks to replace a file of the same name, then keeps the new one in its place", async () => {
    await signInAs(["stage"], "pat");
    const held = heldSetPlan();
    apiHolds(show, held);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const confirm = answerReplace(true);

    await choose(wrapper, aFile("set-plan.pdf", 5_000));

    expect(confirm).toHaveBeenCalledWith(REPLACE);
    const [[, init] = []] = uploadRequests();
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "set-plan.pdf",
      size: 5_000,
      replace: true,
    });
    expect(held["opening-number"]).toEqual([{ name: "set-plan.pdf", size: 5_000 }]);
    expect(rows(wrapper)).toEqual([{ name: "set-plan.pdf", size: "5 KB" }]);
  });

  it("uploads nothing when pat cancels the replace, keeping the old file", async () => {
    await signInAs(["stage"], "pat");
    const held = heldSetPlan();
    apiHolds(show, held);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const confirm = answerReplace(false);

    await choose(wrapper, aFile("set-plan.pdf", 5_000));

    expect(confirm).toHaveBeenCalledWith(REPLACE);
    expect(uploadRequests()).toEqual([]);
    expect(storageRequests()).toEqual([]);
    expect(held["opening-number"]).toEqual([{ name: "set-plan.pdf", size: 2_400_000 }]);
    expect(rows(wrapper)).toEqual([{ name: "set-plan.pdf", size: "2.4 MB" }]);
  });

  it("adds a name that differs only in case as a second file, without asking", async () => {
    await signInAs(["stage"], "pat");
    const held = heldSetPlan();
    apiHolds(show, held);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const confirm = answerReplace(true);

    await choose(wrapper, aFile("Set-Plan.pdf", 5_000));

    expect(confirm).not.toHaveBeenCalled();
    expect(held["opening-number"]).toEqual([
      { name: "set-plan.pdf", size: 2_400_000 },
      { name: "Set-Plan.pdf", size: 5_000 },
    ]);
    expect(rows(wrapper)).toHaveLength(2);
  });

  it("asks to replace a file another browser added since the page loaded", async () => {
    await signInAs(["stage"], "pat");
    const held: Record<string, SceneryFile[]> = { "opening-number": [] };
    apiHolds(show, held);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    held["opening-number"] = [{ name: "set-plan.pdf", size: 2_400_000 }];
    const confirm = answerReplace(true);

    await choose(wrapper, aFile("set-plan.pdf", 5_000));

    expect(confirm).toHaveBeenCalledWith(REPLACE);
    expect(held["opening-number"]).toEqual([{ name: "set-plan.pdf", size: 5_000 }]);
    expect(rows(wrapper)).toEqual([{ name: "set-plan.pdf", size: "5 KB" }]);
  });

  it("lists another browser's file and keeps it when pat cancels the replace", async () => {
    await signInAs(["stage"], "pat");
    const held: Record<string, SceneryFile[]> = { "opening-number": [] };
    apiHolds(show, held);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    held["opening-number"] = [{ name: "set-plan.pdf", size: 2_400_000 }];
    answerReplace(false);

    await choose(wrapper, aFile("set-plan.pdf", 5_000));

    expect(storageRequests()).toEqual([]);
    expect(held["opening-number"]).toEqual([{ name: "set-plan.pdf", size: 2_400_000 }]);
    expect(rows(wrapper)).toEqual([{ name: "set-plan.pdf", size: "2.4 MB" }]);
  });
});
