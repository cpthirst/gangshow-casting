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

type Department = "scenery" | "sfx";
/** Each department's files, by item id, as file storage holds them now. */
type Held = Partial<Record<Department, Record<string, SceneryFile[]>>>;

/** A stand-in API holding the running order, each department's files, changed by uploads
 *  and deletes, and any SFX notes. */
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
      if (url === "/api/productions/2027/sfx-notes") return json({ productionId: "2027", notes });
      if (url === STORAGE && init?.body instanceof FormData) {
        const { department, itemId, name, size } = JSON.parse(String(init.body.get("key")));
        const files = filesOf(department, itemId);
        files.splice(0, files.length, ...files.filter((f) => f.name !== name), { name, size });
        return new Response(null, { status: 204 });
      }
      const [, itemId = "", department, what, query = ""] =
        /^\/api\/productions\/2027\/items\/([^/]+)\/(scenery|sfx)-([a-z-]+)\??(.*)$/.exec(url) ??
        [];
      if (department !== "scenery" && department !== "sfx") {
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

const OPENING_NUMBER = "/production/items/opening-number/sfx";

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

const problem = (wrapper: VueWrapper) => wrapper.get("main [data-test=file-problem]").text();

/** Answers the page's confirm, as the person would. */
function answerConfirm(confirmed: boolean) {
  const confirm = vi.fn(() => confirmed);
  vi.stubGlobal("confirm", confirm);
  return confirm;
}

describe("An item's SFX page", () => {
  it("lists the item's files by name, each with its type icon, full name and size", async () => {
    apiHolds(show, {
      sfx: {
        "opening-number": [
          { name: "thunder.mp3", size: 2_400_000 },
          { name: "applause.wav", size: 8_100_000 },
        ],
      },
    });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(wrapper.get("main h1").text()).toBe("SFX: Opening Number");
    expect(wrapper.get("main").text()).not.toContain("Coming soon");
    expect(rows(wrapper)).toEqual([
      { icon: "fa-file-audio", name: "applause.wav", size: "8.1 MB" },
      { icon: "fa-file-audio", name: "thunder.mp3", size: "2.4 MB" },
    ]);
    expect(wrapper.find("main ul[aria-label='SFX files']").exists()).toBe(true);
  });

  it("tells lee, with Tech, that the item has no SFX files yet, and how to add one", async () => {
    await signInAs(["tech"], "lee");
    apiHolds(show);
    const { wrapper } = await openAppAt("/production/items/finale/sfx");

    expect(wrapper.findAll("main [data-test=file]")).toEqual([]);
    expect(wrapper.get("[data-test=no-files]").text()).toBe("No SFX files for this item yet.");
    expect(wrapper.get("[data-test=how-to-add]").text()).toBe(
      "Add one with Add a file above, or drag one there.",
    );
    // A phone or tablet can't drag a file in: the drag clause hides there, as the upload's does.
    expect(wrapper.get("[data-test=how-to-add] .upload-drop-hint").text()).toBe(
      ", or drag one there",
    );
  });

  it("goes back to the Overview, and steps to the previous and next items' SFX pages", async () => {
    apiHolds(show);
    const { wrapper, router } = await openAppAt("/production/items/campfire-song/sfx");

    const steps = wrapper
      .findAll("main nav[aria-label='Item navigation'] a[rel]")
      .map((link) => [link.attributes("rel"), link.attributes("href")]);
    expect(steps).toEqual([
      ["prev", "/production/items/opening-number/sfx"],
      ["next", "/production/items/finale/sfx"],
    ]);

    await wrapper.get("main a.back-link").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/production/overview");
  });

  it("says an item that isn't in the running order wasn't found, with a link back", async () => {
    apiHolds(show);
    const { wrapper } = await openAppAt("/production/items/no-such-item/sfx");

    expect(wrapper.get("main h1").text()).toBe("Item not found");
    expect(wrapper.find("[data-test=no-files]").exists()).toBe(false);
    expect(wrapper.get("main a.back-link").attributes("href")).toBe("/production/overview");
  });

  it("lists only the SFX files, and the Scenery page only the scenery files", async () => {
    apiHolds(show, {
      scenery: { "opening-number": [{ name: "set-plan.pdf", size: 10 }] },
      sfx: { "opening-number": [{ name: "thunder.mp3", size: 10 }] },
    });
    const sfx = await openAppAt(OPENING_NUMBER);
    expect(names(sfx.wrapper)).toEqual(["thunder.mp3"]);
    sfx.wrapper.unmount();

    const { wrapper } = await openAppAt("/production/items/opening-number/scenery");

    expect(names(wrapper)).toEqual(["set-plan.pdf"]);
  });
});

describe("Uploading an SFX file", () => {
  it("shows lee's upload's progress, then lists the file, with no line about photos", async () => {
    await signInAs(["tech"], "lee");
    const held: Held = {};
    apiHolds(show, held);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    expect(wrapper.get("main [data-test=upload-area]").text()).not.toContain("photos");
    const stand = vi.mocked(fetch).getMockImplementation();
    const waiting: (() => void)[] = [];
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (url === STORAGE) await new Promise<void>((resolve) => waiting.push(resolve));
      return stand?.(url, init) ?? new Response(null, { status: 500 });
    });

    await chooseToUpload(wrapper, aFile("thunder.mp3", 2_400_000));
    StandInXhr.latest?.sent(1_200_000, 2_400_000);
    await flushPromises();
    expect(wrapper.get("main [data-test=upload-progress]").text()).toBe(
      "Uploading thunder.mp3: 1.2 MB of 2.4 MB",
    );
    for (const release of waiting) release();
    await flushPromises();

    expect(requests((url) => url.endsWith("-uploads"))).toEqual([
      "/api/productions/2027/items/opening-number/sfx-uploads",
    ]);
    expect(held.sfx?.["opening-number"]).toEqual([{ name: "thunder.mp3", size: 2_400_000 }]);
    expect(held.scenery?.["opening-number"] ?? []).toEqual([]);
    expect(names(wrapper)).toEqual(["thunder.mp3"]);
  });

  it("refuses a file over 100 MB, naming it and why", async () => {
    await signInAs(["tech"], "lee");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await chooseToUpload(wrapper, aFile("overture.wav", 120_000_000));

    expect(problem(wrapper)).toBe("overture.wav is over 100 MB, so it wasn't uploaded.");
    expect(requests((url) => url.endsWith("/sfx-uploads"))).toEqual([]);
  });

  it("says an upload that failed part way wasn't uploaded, and tries it again", async () => {
    await signInAs(["tech"], "lee");
    apiHolds(show);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const stand = vi.mocked(fetch).getMockImplementation();
    let dropped = false;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (url === STORAGE && !dropped) {
        dropped = true;
        throw new TypeError("Failed to fetch");
      }
      return stand?.(url, init) ?? new Response(null, { status: 500 });
    });

    await chooseToUpload(wrapper, aFile("thunder.mp3"));
    expect(problem(wrapper)).toBe(
      "thunder.mp3 wasn't uploaded. Check your connection and try again.",
    );
    await wrapper.get("main [data-test=try-again]").trigger("click");
    await flushPromises();

    expect(names(wrapper)).toEqual(["thunder.mp3"]);
  });

  it.each([
    [true, 5_000],
    [false, 2_400_000],
  ])(
    "replaces a file of the same name once lee confirms (%s), keeping one",
    async (confirmed, size) => {
      await signInAs(["tech"], "lee");
      const held: Held = { sfx: { "opening-number": [{ name: "thunder.mp3", size: 2_400_000 }] } };
      apiHolds(show, held);
      const { wrapper } = await openAppAt(OPENING_NUMBER);
      const confirm = answerConfirm(confirmed);

      await chooseToUpload(wrapper, aFile("thunder.mp3", 5_000));

      expect(confirm).toHaveBeenCalledWith(
        "Replace thunder.mp3? The old copy can't be brought back.",
      );
      expect(held.sfx?.["opening-number"]).toEqual([{ name: "thunder.mp3", size }]);
    },
  );
});

describe("An item's SFX audio files", () => {
  it("shows each audio file with the audio file icon", async () => {
    const audio = ["thunder.mp3", "applause.wav", "intro.m4a", "chime.aac", "wind.ogg"];
    apiHolds(show, { sfx: { "opening-number": audio.map((name) => ({ name, size: 10 })) } });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(rows(wrapper).map(({ name, icon }) => [name, icon])).toEqual(
      [...audio].sort().map((name) => [name, "fa-file-audio"]),
    );
  });

  it("shows a PDF with the PDF icon and a Word file with the Word icon, as on Scenery", async () => {
    apiHolds(show, {
      sfx: {
        "opening-number": [
          { name: "cue-sheet.pdf", size: 10 },
          { name: "cues.docx", size: 10 },
        ],
      },
    });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(rows(wrapper).map(({ name, icon }) => [name, icon])).toEqual([
      ["cue-sheet.pdf", "fa-file-pdf"],
      ["cues.docx", "fa-file-word"],
    ]);
  });

  it("names an audio file for a screen reader as one that opens", async () => {
    apiHolds(show, { sfx: { "opening-number": [{ name: "thunder.mp3", size: 10 }] } });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(rowFor(wrapper, "thunder.mp3").get(".file-open").attributes("aria-label")).toBe(
      "Open thunder.mp3, MP3 file",
    );
  });
});

describe("Opening and downloading an SFX file", () => {
  const tab = { show: vi.fn(), close: vi.fn() };
  beforeEach(() => {
    vi.mocked(openFileTab).mockReset().mockReturnValue(tab);
    vi.mocked(downloadFrom).mockReset();
    tab.show.mockReset();
  });

  async function choose(wrapper: VueWrapper, name: string) {
    await rowFor(wrapper, name).get(".file-open").trigger("click");
    await flushPromises();
  }

  it("opens an MP3 in a new tab to play, with no download", async () => {
    await signInAs([], "jo");
    apiHolds(show, { sfx: { "opening-number": [{ name: "thunder.mp3", size: 10 }] } });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await choose(wrapper, "thunder.mp3");

    expect(requests((url) => url.includes("-file-link?"))).toEqual([
      "/api/productions/2027/items/opening-number/sfx-file-link?name=thunder.mp3",
    ]);
    expect(tab.show).toHaveBeenCalledWith(linkTo("thunder.mp3"));
    expect(downloadFrom).not.toHaveBeenCalled();
  });

  it("downloads notes.mp3.html, going by its last extension, and opens no tab", async () => {
    await signInAs([], "jo");
    apiHolds(show, { sfx: { "opening-number": [{ name: "notes.mp3.html", size: 10 }] } });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await choose(wrapper, "notes.mp3.html");

    expect(downloadFrom).toHaveBeenCalledWith(linkTo("notes.mp3.html"));
    expect(openFileTab).not.toHaveBeenCalled();
  });

  it("opens a PDF in a new tab, and downloads a Word file", async () => {
    await signInAs([], "jo");
    apiHolds(show, {
      sfx: {
        "opening-number": [
          { name: "cue-sheet.pdf", size: 10 },
          { name: "cues.docx", size: 10 },
        ],
      },
    });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    await choose(wrapper, "cue-sheet.pdf");
    await choose(wrapper, "cues.docx");

    expect(tab.show).toHaveBeenCalledWith(linkTo("cue-sheet.pdf"));
    expect(tab.show).toHaveBeenCalledTimes(1);
    expect(downloadFrom).toHaveBeenCalledWith(linkTo("cues.docx"));
    expect(downloadFrom).toHaveBeenCalledTimes(1);
  });
});

describe("Deleting an SFX file", () => {
  it.each([
    [true, []],
    [false, ["thunder.mp3"]],
  ])("asks lee to confirm (%s), then deletes it for everyone", async (confirmed, left) => {
    await signInAs(["tech"], "lee");
    const held: Held = { sfx: { "opening-number": [{ name: "thunder.mp3", size: 10 }] } };
    apiHolds(show, held);
    const { wrapper } = await openAppAt(OPENING_NUMBER);
    const confirm = answerConfirm(confirmed);

    await rowFor(wrapper, "thunder.mp3").get("[data-test=delete]").trigger("click");
    await flushPromises();

    expect(confirm).toHaveBeenCalledWith("Remove thunder.mp3? This can't be undone.");
    expect(names(wrapper)).toEqual(left);
    expect(held.sfx?.["opening-number"]?.map((file) => file.name)).toEqual(left);
  });
});

describe("SFX notes", () => {
  it("saves lee's SFX notes for the item, shown on the next visit, apart from other items'", async () => {
    await signInAs(["tech"], "lee");
    const notes: ItemNote[] = [{ itemId: "finale", text: "Fanfare", revision: 1 }];
    apiHolds(show, {}, notes);
    const first = await openAppAt(OPENING_NUMBER);
    expect(notesSection(first.wrapper).get("h2").text()).toBe("SFX notes");

    await notesSection(first.wrapper).get("textarea").setValue("Thunder on the second verse");
    await notesSection(first.wrapper).get("form").trigger("submit");
    await flushPromises();
    first.wrapper.unmount();
    await signInAs([], "jo");
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(requests((_, init) => init?.method === "PUT")).toEqual([
      "/api/productions/2027/items/opening-number/sfx-notes",
    ]);
    expect(notesSection(wrapper).get("[data-test=notes-text]").text()).toBe(
      "Thunder on the second verse",
    );
    expect(notes).toContainEqual({ itemId: "finale", text: "Fanfare", revision: 1 });
  });
});

describe("Who can change the SFX", () => {
  it("shows pat, with Stage only, the files and notes with nothing to change them", async () => {
    await signInAs(["stage"], "pat");
    apiHolds(show, { sfx: { "opening-number": [{ name: "thunder.mp3", size: 10 }] } }, [
      { itemId: "opening-number", text: "Thunder on the second verse", revision: 1 },
    ]);
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(names(wrapper)).toEqual(["thunder.mp3"]);
    expect(notesSection(wrapper).get("[data-test=notes-text]").text()).toBe(
      "Thunder on the second verse",
    );
    expect(wrapper.find("main [data-test=upload-area]").exists()).toBe(false);
    expect(wrapper.find("main [data-test=delete]").exists()).toBe(false);
    expect(notesSection(wrapper).find("textarea").exists()).toBe(false);
    expect(wrapper.get("[data-test=read-only]").text()).toBe(
      "You can view the SFX, but not change them: only Tech, Director and admins can.",
    );
  });

  it.each([
    [["director"], "dee"],
    [["admin"], "ash"],
  ])("lets %s upload, delete and change the notes", async (groups, name) => {
    await signInAs(groups, name);
    apiHolds(show, { sfx: { "opening-number": [{ name: "thunder.mp3", size: 10 }] } });
    const { wrapper } = await openAppAt(OPENING_NUMBER);

    expect(wrapper.find("main [data-test=upload-area]").exists()).toBe(true);
    expect(wrapper.find("main [data-test=delete]").exists()).toBe(true);
    expect(notesSection(wrapper).find("textarea").exists()).toBe(true);
    expect(wrapper.find("[data-test=read-only]").exists()).toBe(false);
  });
});
