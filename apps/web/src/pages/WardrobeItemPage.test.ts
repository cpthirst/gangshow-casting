import {
  type ItemNote,
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
import { StandInXhr } from "@/services/file-upload.fixture.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";
import { RUNNING_ORDER_PATH } from "@/utils/running-order.ts";

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

// Made-up items, in show order: Opening Number, Campfire Song | Finale.
const show = aRunningOrder([anItem("Opening Number"), anItem("Campfire Song")], [anItem("Finale")]);

const json = (body: unknown) => new Response(JSON.stringify(body));
const linkTo = (name: string) => `https://files.example/${encodeURIComponent(name)}?signed`;
/** Where the stand-in file storage takes uploads, apart from the API, as the bucket is. */
const STORAGE = "https://files.example/";

type Department = "scenery" | "sfx" | "wardrobe";
/** Each department's files, by item id, as file storage holds them now. */
type Held = Partial<Record<Department, Record<string, SceneryFile[]>>>;

/** A stand-in API holding the running order, each department's files, changed by uploads
 *  and deletes, and any Wardrobe notes. */
function apiHolds(order: RunningOrder, held: Held = {}, notes: ItemNote[] = []) {
  const filesOf = (department: Department, itemId: string) => {
    const byItem = held[department] ?? {};
    held[department] = byItem;
    const files = byItem[itemId] ?? [];
    byItem[itemId] = files;
    return files;
  };
  vi.stubGlobal("XMLHttpRequest", StandInXhr);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === RUNNING_ORDER_PATH) return json(order);
      if (url === "/api/productions/2027/wardrobe-notes")
        return json({ productionId: "2027", notes });
      if (url === STORAGE && init?.body instanceof FormData) {
        const { department, itemId, name, size } = JSON.parse(String(init.body.get("key")));
        const files = filesOf(department, itemId);
        files.splice(0, files.length, ...files.filter((f) => f.name !== name), { name, size });
        return new Response(null, { status: 204 });
      }
      const [, itemId = "", department, what, query = ""] =
        /^\/api\/productions\/2027\/items\/([^/]+)\/(scenery|sfx|wardrobe)-([a-z-]+)\??(.*)$/.exec(
          url,
        ) ?? [];
      if (department !== "scenery" && department !== "sfx" && department !== "wardrobe") {
        if (url === "/api/usage") return new Response(null, { status: 204 });
        return json({ status: "ok", version: "dev" });
      }
      const files = filesOf(department, itemId);
      const name = new URLSearchParams(query).get("name");
      if (what === "notes" && init?.method === "PUT") {
        const { text, revision } = SaveItemNoteRequest.parse(JSON.parse(String(init.body)));
        const saved = { itemId, text, revision: revision + 1 };
        notes.splice(0, notes.length, ...notes.filter((n) => n.itemId !== itemId), saved);
        return json(saved);
      }
      if (what === "uploads") {
        const request = SceneryUploadRequest.parse(JSON.parse(String(init?.body)));
        if (!request.replace && files.some((file) => file.name === request.name)) {
          return new Response(null, { status: 409 });
        }
        const key = { department, itemId, name: request.name, size: request.size };
        return json({ url: STORAGE, fields: { key: JSON.stringify(key) } });
      }
      const at = files.findIndex((file) => file.name === name);
      if (what === "files" && init?.method === "DELETE") {
        if (at < 0) return new Response(null, { status: 404 });
        files.splice(at, 1);
        return new Response(null, { status: 204 });
      }
      if (what === "files") return json({ files });
      if (what === "file-link" && name !== null && at >= 0) return json({ url: linkTo(name) });
      return new Response(null, { status: 404 });
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

const OPENING_NUMBER = "/production/items/opening-number/wardrobe";

const rows = (wrapper: VueWrapper) =>
  wrapper.findAll("main [data-test=file]").map((row) => ({
    icon: row
      .get(".file-icon")
      .classes()
      .find((name) => name.startsWith("fa-file")),
    name: row.get("[data-test=name]").text(),
    size: row.get("[data-test=size]").text(),
  }));
const names = (wrapper: VueWrapper) => rows(wrapper).map((row) => row.name);

const rowFor = (wrapper: VueWrapper, name: string) => {
  const row = wrapper
    .findAll("main [data-test=file]")
    .find((found) => found.get("[data-test=name]").text() === name);
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

const notesSection = (wrapper: VueWrapper) => wrapper.get("section[aria-labelledby=notes-heading]");

/** A made-up file, of the size given, as the browser's file picker hands it over. */
function aFile(name: string, size = 1_000) {
  const file = new File(["made-up"], name);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

// As the file picker does once someone chooses a file.
async function chooseToUpload(wrapper: VueWrapper, file: File) {
  const input = wrapper.get("main [data-test=upload-input]");
  Object.defineProperty(input.element, "files", { value: [file], configurable: true });
  await input.trigger("change");
  await flushPromises();
}

const requests = (match: (url: string, init?: RequestInit) => boolean) =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([url, init]) => match(String(url), init))
    .map(([url]) => String(url));

/** Answers the page's confirm, as the person would. */
function answerConfirm(confirmed: boolean) {
  const confirm = vi.fn(() => confirmed);
  vi.stubGlobal("confirm", confirm);
  return confirm;
}

describe("An item's Wardrobe page", () => {
  it("lists the item's files by name, each with its type icon, full name and size", async () => {
    apiHolds(show, {
      wardrobe: {
        "opening-number": [
          { name: "jacket-pattern.pdf", size: 1_200_000 },
          { name: "colour-swatch.png", size: 300_000 },
        ],
      },
    });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(wrapper.get("main h1").text()).toBe("Wardrobe: Opening Number");
    expect(wrapper.get("main").text()).not.toContain("Coming soon");
    expect(rows(wrapper)).toEqual([
      { icon: "fa-file-image", name: "colour-swatch.png", size: "300 KB" },
      { icon: "fa-file-pdf", name: "jacket-pattern.pdf", size: "1.2 MB" },
    ]);
    expect(wrapper.find("main ul[aria-label='Wardrobe files']").exists()).toBe(true);
  });

  it("tells kit, with Wardrobe, that the item has no Wardrobe files yet, and how to add one", async () => {
    await signInAs(["wardrobe"], "kit");
    apiHolds(show);
    const { wrapper } = await openAppAt("/production/items/finale/wardrobe");

    expect(wrapper.findAll("main [data-test=file]")).toEqual([]);
    expect(wrapper.get("[data-test=no-files]").text()).toBe("No wardrobe files for this item yet.");
    expect(wrapper.get("[data-test=how-to-add]").text()).toBe(
      "Add one with Add a file above, or drag one there.",
    );
  });

  it("goes back to the Overview, and steps to the previous and next items' Wardrobe pages", async () => {
    apiHolds(show);
    const { wrapper, router } = await openAppAt("/production/items/campfire-song/wardrobe");

    const steps = wrapper
      .findAll("main nav[aria-label='Item navigation'] a[rel]")
      .map((link) => [link.attributes("rel"), link.attributes("href")]);
    expect(steps).toEqual([
      ["prev", "/production/items/opening-number/wardrobe"],
      ["next", "/production/items/finale/wardrobe"],
    ]);

    await wrapper.get("main a.back-link").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/production/overview");
  });

  it("has a help button beside the item's name, which opens the Wardrobe page's help", async () => {
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    const row = wrapper.get("main .page-title-row");
    expect(row.get("h1").text()).toBe("Wardrobe: Opening Number");
    await row.get("button[aria-label='Help for this item']").trigger("click");

    const names = wrapper.findAll("dialog [data-test=help-name]").map((name) => name.text());
    expect(names).toEqual([
      "All items",
      "Previous and Next",
      "Files",
      "Remove",
      "Add a file",
      "Wardrobe notes",
    ]);
  });

  it("says an item that isn't in the running order wasn't found, with a link back", async () => {
    apiHolds(show);
    const { wrapper } = await openAppAt("/production/items/no-such-item/wardrobe");

    expect(wrapper.get("main h1").text()).toBe("Item not found");
    expect(wrapper.find("[data-test=no-files]").exists()).toBe(false);
    expect(wrapper.get("main a.back-link").attributes("href")).toBe("/production/overview");
  });

  it("lists only the Wardrobe files, not the scenery or SFX files", async () => {
    apiHolds(show, {
      scenery: { "opening-number": [{ name: "set-plan.pdf", size: 10 }] },
      sfx: { "opening-number": [{ name: "thunder.mp3", size: 10 }] },
      wardrobe: { "opening-number": [{ name: "jacket-pattern.pdf", size: 10 }] },
    });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(names(wrapper)).toEqual(["jacket-pattern.pdf"]);
    expect(requests((url) => url.includes("/items/"))).toEqual([
      "/api/productions/2027/items/opening-number/wardrobe-files",
    ]);
  });
});

describe("Uploading a Wardrobe file", () => {
  it("tells kit the upload area is for costume designs and images only, with no photos of cast members", async () => {
    await signInAs(["wardrobe"], "kit");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(wrapper.get("main [data-test=upload-area] .upload-rule").text()).toBe(
      "Costume designs and images only: no photos of cast members.",
    );
  });

  it("shows kit's upload's progress, then lists the file in the Wardrobe files only", async () => {
    await signInAs(["wardrobe"], "kit");
    const held: Held = {};
    apiHolds(show, held);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const stand = vi.mocked(fetch).getMockImplementation();
    const waiting: (() => void)[] = [];
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (url === STORAGE) await new Promise<void>((resolve) => waiting.push(resolve));
      return stand?.(url, init) ?? new Response(null, { status: 500 });
    });

    await chooseToUpload(wrapper, aFile("jacket-pattern.pdf", 1_200_000));
    StandInXhr.latest?.sent(600_000, 1_200_000);
    await flushPromises();
    expect(wrapper.get("main [data-test=upload-progress]").text()).toBe(
      "Uploading jacket-pattern.pdf: 600 KB of 1.2 MB",
    );
    for (const release of waiting) release();
    await flushPromises();

    expect(requests((url) => url.endsWith("-uploads"))).toEqual([
      "/api/productions/2027/items/opening-number/wardrobe-uploads",
    ]);
    expect(held.wardrobe?.["opening-number"]).toEqual([
      { name: "jacket-pattern.pdf", size: 1_200_000 },
    ]);
    expect(held.sfx?.["opening-number"] ?? []).toEqual([]);
    expect(names(wrapper)).toEqual(["jacket-pattern.pdf"]);
  });

  it.each([
    [true, 5_000],
    [false, 1_200_000],
  ])(
    "replaces a file of the same name once kit confirms (%s), keeping one",
    async (confirmed, size) => {
      await signInAs(["wardrobe"], "kit");
      const held: Held = {
        wardrobe: { "opening-number": [{ name: "jacket-pattern.pdf", size: 1_200_000 }] },
      };
      apiHolds(show, held);
      const { wrapper } = await openAppAt(OPENING_NUMBER);
      const confirm = answerConfirm(confirmed);

      await chooseToUpload(wrapper, aFile("jacket-pattern.pdf", 5_000));

      expect(confirm).toHaveBeenCalledWith(
        "Replace jacket-pattern.pdf? The old copy can't be brought back.",
      );
      expect(held.wardrobe?.["opening-number"]).toEqual([{ name: "jacket-pattern.pdf", size }]);
    },
  );
});

describe("Opening and downloading a Wardrobe file", () => {
  const tab = { show: vi.fn(), close: vi.fn() };
  beforeEach(() => {
    vi.mocked(openFileTab).mockReset().mockReturnValue(tab);
    vi.mocked(downloadFrom).mockReset();
    tab.show.mockReset();
  });

  it("opens an image in a new tab, and downloads a spreadsheet", async () => {
    await signInAs([], "jo");
    apiHolds(show, {
      wardrobe: {
        "opening-number": [
          { name: "colour-swatch.png", size: 10 },
          { name: "fabric-order.xlsx", size: 10 },
        ],
      },
    });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await rowFor(wrapper, "colour-swatch.png").get(".file-open").trigger("click");
    await flushPromises();
    await rowFor(wrapper, "fabric-order.xlsx").get(".file-open").trigger("click");
    await flushPromises();

    expect(requests((url) => url.includes("-file-link?"))).toEqual([
      "/api/productions/2027/items/opening-number/wardrobe-file-link?name=colour-swatch.png",
      "/api/productions/2027/items/opening-number/wardrobe-file-link?name=fabric-order.xlsx",
    ]);
    expect(tab.show).toHaveBeenCalledWith(linkTo("colour-swatch.png"));
    expect(downloadFrom).toHaveBeenCalledWith(linkTo("fabric-order.xlsx"));
  });

  it("shows an MP3 with the general file icon, and downloads it", async () => {
    apiHolds(show, { wardrobe: { "opening-number": [{ name: "thunder.mp3", size: 10 }] } });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(rows(wrapper).map((row) => row.icon)).toEqual(["fa-file"]);
    await rowFor(wrapper, "thunder.mp3").get(".file-open").trigger("click");
    await flushPromises();

    expect(downloadFrom).toHaveBeenCalledWith(linkTo("thunder.mp3"));
    expect(openFileTab).not.toHaveBeenCalled();
  });
});

describe("Deleting a Wardrobe file", () => {
  it.each([
    [true, []],
    [false, ["jacket-pattern.pdf"]],
  ])("asks kit to confirm (%s), then deletes it for everyone", async (confirmed, left) => {
    await signInAs(["wardrobe"], "kit");
    const held: Held = {
      wardrobe: { "opening-number": [{ name: "jacket-pattern.pdf", size: 10 }] },
    };
    apiHolds(show, held);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const confirm = answerConfirm(confirmed);

    await rowFor(wrapper, "jacket-pattern.pdf").get("[data-test=delete]").trigger("click");
    await flushPromises();

    expect(confirm).toHaveBeenCalledWith("Remove jacket-pattern.pdf? This can't be undone.");
    expect(names(wrapper)).toEqual(left);
    expect(held.wardrobe?.["opening-number"]?.map((file) => file.name)).toEqual(left);
  });
});

describe("Wardrobe notes", () => {
  it("saves kit's Wardrobe notes for the item, shown on the next visit, apart from other items'", async () => {
    await signInAs(["wardrobe"], "kit");
    const notes: ItemNote[] = [{ itemId: "finale", text: "Bow ties", revision: 1 }];
    apiHolds(show, {}, notes);
    const first = await openAppAt(OPENING_NUMBER);
    expect(notesSection(first.wrapper).get("h2").text()).toBe("Wardrobe notes");

    await notesSection(first.wrapper).get("textarea").setValue("Gold jackets for the chorus");
    await notesSection(first.wrapper).get("form").trigger("submit");
    await flushPromises();
    first.wrapper.unmount();
    await signInAs([], "jo");
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(requests((_, init) => init?.method === "PUT")).toEqual([
      "/api/productions/2027/items/opening-number/wardrobe-notes",
    ]);
    expect(notesSection(wrapper).get("[data-test=notes-text]").text()).toBe(
      "Gold jackets for the chorus",
    );
    expect(notes).toContainEqual({ itemId: "finale", text: "Bow ties", revision: 1 });
  });
});

describe("Who can change the wardrobe", () => {
  it("shows lee, with Tech only, the files and notes with nothing to change them", async () => {
    await signInAs(["tech"], "lee");
    apiHolds(show, { wardrobe: { "opening-number": [{ name: "jacket-pattern.pdf", size: 10 }] } }, [
      { itemId: "opening-number", text: "Gold jackets for the chorus", revision: 1 },
    ]);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(names(wrapper)).toEqual(["jacket-pattern.pdf"]);
    expect(notesSection(wrapper).get("[data-test=notes-text]").text()).toBe(
      "Gold jackets for the chorus",
    );
    expect(wrapper.find("main [data-test=upload-area]").exists()).toBe(false);
    expect(wrapper.find("main [data-test=delete]").exists()).toBe(false);
    expect(notesSection(wrapper).find("textarea").exists()).toBe(false);
    expect(wrapper.get("[data-test=read-only]").text()).toBe(
      "You can view the wardrobe, but not change it: only Wardrobe, Director and admins can.",
    );
  });

  it.each([
    [["director"], "dee"],
    [["admin"], "ash"],
  ])("lets %s upload, delete and change the notes", async (groups, name) => {
    await signInAs(groups, name);
    apiHolds(show, { wardrobe: { "opening-number": [{ name: "jacket-pattern.pdf", size: 10 }] } });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(wrapper.find("main [data-test=upload-area]").exists()).toBe(true);
    expect(wrapper.find("main [data-test=delete]").exists()).toBe(true);
    expect(notesSection(wrapper).find("textarea").exists()).toBe(true);
    expect(wrapper.find("[data-test=read-only]").exists()).toBe(false);
  });
});

describe("Recording a visit to an item's Wardrobe page (production-sfx-wardrobe FR13)", () => {
  // Everything recorded but sessions, which are sign-ins, not uses of this page.
  const recorded = () =>
    vi
      .mocked(fetch)
      .mock.calls.filter(([url, init]) => url === "/api/usage" && init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body)))
      .filter((body) => body.event !== "session");

  it("records lee opening an item's Wardrobe page, naming only the item and its production", async () => {
    await signInAs(["tech"], "lee");
    apiHolds(show);

    await openAppAt(OPENING_NUMBER);

    expect(recorded()).toEqual([
      { event: "wardrobe", productionId: "2027", itemId: "opening-number" },
    ]);
  });

  it("records nothing for an item that isn't in the running order", async () => {
    apiHolds(show);

    const { wrapper } = await openAppAt("/production/items/no-such-item/wardrobe");

    expect(wrapper.get("main h1").text()).toBe("Item not found");
    expect(recorded()).toEqual([]);
  });
});

describe("Loading the Wardrobe page's data", () => {
  it("says it couldn't load the item when the API fails to give its files", async () => {
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
});
