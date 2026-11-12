import {
  type CastMember,
  type Costume,
  type FileDepartment,
  type ItemFile,
  ItemFileUploadRequest,
  type ItemNote,
  type Role,
  SaveCostumeRequest,
  SaveItemNoteRequest,
} from "@app/shared";
import { enableAutoUnmount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { json, openAppAt } from "@/app.fixture.ts";
import * as confirmDialog from "@/components/common/ConfirmDialog.fixture.ts";
import { downloadFrom, openFileTab } from "@/services/file-link.ts";
import { StandInXhr } from "@/services/file-upload.fixture.ts";
import {
  castPath,
  costumesPath,
  rolesPath,
  runningOrderPath,
  saveCostumePath,
} from "@/services/production.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import {
  aRole,
  captainHook,
  chrisEvans,
  kimLee,
  pirateCast,
  pirates,
} from "@/utils/casting.fixture.ts";
import { alexAsHook, costumeFieldsOf, costumeFormField } from "@/utils/costumes.fixture.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";

// Every file department's page is the same component: SceneryItemPage.test.ts covers how it
// behaves, and this file that each department is wired to its own files, notes and
// permissions, and what's different about SFX and Wardrobe.

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

const linkTo = (name: string) => `https://files.example/${encodeURIComponent(name)}?signed`;
/** Where the stand-in file storage takes uploads, apart from the API, as the bucket is. */
const STORAGE = "https://files.example/";

/** Each department's files, by item id, as file storage holds them now. */
type Held = Partial<Record<FileDepartment, Record<string, ItemFile[]>>>;

/** The casting the Wardrobe page reads its costume rows from: every role, and the cast list. */
interface Casting {
  roles: Role[];
  cast: CastMember[];
}

const NOBODY_CAST: Casting = { roles: [], cast: [] };

/** A stand-in API holding the running order, each department's files, changed by uploads
 *  and deletes, any notes, the casting, and the costumes, changed by saves. */
function apiHolds(
  held: Held = {},
  notes: ItemNote[] = [],
  casting = NOBODY_CAST,
  costumes: Costume[] = [],
) {
  const filesOf = (department: FileDepartment, itemId: string) => {
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
      if (url === runningOrderPath()) return json(show);
      if (url === rolesPath()) return json({ productionId: "2027", roles: casting.roles });
      if (url === castPath()) return json({ productionId: "2027", members: casting.cast });
      if (url === costumesPath()) return json({ productionId: "2027", costumes });
      if (url === saveCostumePath("opening-number") && init?.method === "PUT") {
        const sent = SaveCostumeRequest.parse(JSON.parse(String(init.body)));
        const saved = { itemId: "opening-number", ...sent };
        const others = costumes.filter(
          (c) => c.roleId !== sent.roleId || c.castMemberId !== sent.castMemberId,
        );
        costumes.splice(0, costumes.length, ...others, saved);
        return json(saved);
      }
      if (/^\/api\/productions\/2027\/(scenery|sfx|wardrobe)-notes$/.test(url)) {
        return json({ productionId: "2027", notes });
      }
      if (url === "/api/usage") return new Response(null, { status: 204 });
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
        const request = ItemFileUploadRequest.parse(JSON.parse(String(init?.body)));
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

const pageOf = (department: FileDepartment, item = "opening-number") =>
  `/production/items/${item}/${department}`;

const names = (wrapper: VueWrapper) =>
  wrapper.findAll("main [data-test=file]").map((row) => row.get("[data-test=name]").text());

const rowFor = (wrapper: VueWrapper, name: string) => {
  const row = wrapper
    .findAll("main [data-test=file]")
    .find((found) => found.get("[data-test=name]").text() === name);
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

const notesSection = (wrapper: VueWrapper) => wrapper.get("section[aria-labelledby=notes-heading]");

async function chooseToUpload(wrapper: VueWrapper, name: string) {
  const file = new File(["made-up"], name);
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

describe.each([
  {
    key: "sfx",
    name: "SFX",
    noun: "SFX",
    other: "scenery",
    file: "thunder.mp3",
    mayChange: ["tech", "director", "admin"],
    viewsOnly: "stage",
  },
  {
    key: "wardrobe",
    name: "Wardrobe",
    noun: "wardrobe",
    other: "sfx",
    file: "jacket-pattern.pdf",
    mayChange: ["wardrobe", "director", "admin"],
    viewsOnly: "tech",
  },
] as const)(
  "The $name page for an item",
  ({ key, name, noun, other, file, mayChange, viewsOnly }) => {
    const itemFiles = () => ({ "opening-number": [{ name: file, size: 10 }] });
    const route = `/api/productions/2027/items/opening-number/${key}`;

    it("lists only its own department's files, under its own title", async () => {
      apiHolds({
        [key]: itemFiles(),
        [other]: { "opening-number": [{ name: "someone-elses.pdf", size: 10 }] },
      });
      const { wrapper } = await openAppAt(pageOf(key));

      expect(wrapper.get("main h1").text()).toBe(`${name}: Opening Number`);
      expect(wrapper.find(`main ul[aria-label='${name} files']`).exists()).toBe(true);
      expect(names(wrapper)).toEqual([file]);
    });

    it("names the department when the item has no files, with no error", async () => {
      apiHolds();
      const { wrapper } = await openAppAt(pageOf(key, "finale"));

      expect(wrapper.get("[data-test=no-files]").text()).toBe(
        `No ${noun} files for this item yet.`,
      );
      expect(wrapper.find("main [role=alert]").exists()).toBe(false);
    });

    it("uploads to its own department, and lists the file", async () => {
      const held: Held = {};
      apiHolds(held);
      const { wrapper } = await openAppAt(pageOf(key));

      await chooseToUpload(wrapper, file);

      expect(requests((url) => url.endsWith("-uploads"))).toEqual([`${route}-uploads`]);
      expect(held[key]?.["opening-number"]?.map((each) => each.name)).toEqual([file]);
      expect(held[other]?.["opening-number"] ?? []).toEqual([]);
      expect(names(wrapper)).toEqual([file]);
    });

    it("deletes from its own department once confirmed", async () => {
      const held: Held = { [key]: itemFiles() };
      apiHolds(held);
      const { wrapper } = await openAppAt(pageOf(key));

      await rowFor(wrapper, file).get("[data-test=delete]").trigger("click");
      await flushPromises();
      await confirmDialog.goAhead();

      expect(requests((_, init) => init?.method === "DELETE")).toEqual([
        `${route}-files?${new URLSearchParams({ name: file })}`,
      ]);
      expect(held[key]?.["opening-number"]).toEqual([]);
    });

    it("asks its own department for a file's link", async () => {
      vi.mocked(openFileTab).mockReset().mockReturnValue({ show: vi.fn(), close: vi.fn() });
      vi.mocked(downloadFrom).mockReset();
      apiHolds({ [key]: itemFiles() });
      const { wrapper } = await openAppAt(pageOf(key));

      await rowFor(wrapper, file).get(".file-open").trigger("click");
      await flushPromises();

      expect(requests((url) => url.includes("-file-link?"))).toEqual([
        `${route}-file-link?${new URLSearchParams({ name: file })}`,
      ]);
    });

    it("saves notes under its own department, shown on the next visit", async () => {
      const notes: ItemNote[] = [];
      apiHolds({}, notes);
      const first = await openAppAt(pageOf(key));
      expect(notesSection(first.wrapper).get("h2").text()).toBe(`${name} notes`);

      await notesSection(first.wrapper).get("textarea").setValue("Cue on the second verse");
      await notesSection(first.wrapper).get("form").trigger("submit");
      await flushPromises();
      first.wrapper.unmount();
      await signInAs([], "jo");
      const { wrapper } = await openAppAt(pageOf(key));

      expect(requests((_, init) => init?.method === "PUT")).toEqual([`${route}-notes`]);
      expect(notesSection(wrapper).get("[data-test=notes-text]").text()).toBe(
        "Cue on the second verse",
      );
    });

    it(`shows someone with ${viewsOnly} only the files and notes, with nothing to change them`, async () => {
      await signInAs([viewsOnly], "pat");
      apiHolds({ [key]: itemFiles() }, [
        { itemId: "opening-number", text: "Cue on the second verse", revision: 1 },
      ]);
      const { wrapper } = await openAppAt(pageOf(key));

      expect(names(wrapper)).toEqual([file]);
      expect(notesSection(wrapper).get("[data-test=notes-text]").text()).toBe(
        "Cue on the second verse",
      );
      expect(wrapper.find("main [data-test=upload-area]").exists()).toBe(false);
      expect(wrapper.find("main [data-test=delete]").exists()).toBe(false);
      expect(notesSection(wrapper).find("textarea").exists()).toBe(false);
      expect(wrapper.find(".page-title-row [data-test=view-only]").exists()).toBe(true);
    });

    it.each(mayChange)(
      "lets someone with %s upload, delete and change the notes",
      async (group) => {
        await signInAs([group], "sam");
        apiHolds({ [key]: itemFiles() });
        const { wrapper } = await openAppAt(pageOf(key));

        expect(wrapper.find("main [data-test=upload-area]").exists()).toBe(true);
        expect(wrapper.find("main [data-test=delete]").exists()).toBe(true);
        expect(notesSection(wrapper).find("textarea").exists()).toBe(true);
        expect(wrapper.find("[data-test=view-only]").exists()).toBe(false);
      },
    );
  },
);

// Each file page's sections, in order: only Wardrobe has Costumes between its files and notes.
describe.each([
  ["Scenery", "scenery", "set-plan.pdf", ["Files", "Scenery notes"]],
  ["SFX", "sfx", "thunder.mp3", ["Files", "SFX notes"]],
  ["Wardrobe", "wardrobe", "jacket-pattern.pdf", ["Files", "Costumes", "Wardrobe notes"]],
] as const)("The %s page", (_name, key, file, sections) => {
  it("heads its files and upload area Files, and has only its own sections after", async () => {
    apiHolds({ [key]: { "opening-number": [{ name: file, size: 10 }] } });
    const { wrapper } = await openAppAt(pageOf(key));

    const files = wrapper.get("main section[aria-labelledby=files-heading]");
    expect(files.get("h2").text()).toBe("Files");
    expect(files.find("[data-test=upload-area]").exists()).toBe(true);
    expect(
      files.findAll("[data-test=file]").map((row) => row.get("[data-test=name]").text()),
    ).toEqual([file]);
    // The page's sections; the help dialog's own title isn't one.
    expect(wrapper.findAll("main section > h2").map((heading) => heading.text())).toEqual(sections);
  });
});

describe("What's different about SFX", () => {
  it("opens an MP3 in a new tab to play, with no download", async () => {
    const tab = { show: vi.fn(), close: vi.fn() };
    vi.mocked(openFileTab).mockReset().mockReturnValue(tab);
    vi.mocked(downloadFrom).mockReset();
    apiHolds({ sfx: { "opening-number": [{ name: "thunder.mp3", size: 10 }] } });
    const { wrapper } = await openAppAt(pageOf("sfx"));

    await rowFor(wrapper, "thunder.mp3").get(".file-open").trigger("click");
    await flushPromises();

    expect(tab.show).toHaveBeenCalledWith(linkTo("thunder.mp3"));
    expect(downloadFrom).not.toHaveBeenCalled();
  });

  it("has no rule about photos on its upload area", async () => {
    apiHolds();
    const { wrapper } = await openAppAt(pageOf("sfx"));

    expect(wrapper.get("main [data-test=upload-area]").text()).not.toContain("photos");
  });
});

describe("What's different about Wardrobe", () => {
  it("says its upload area is for costume designs and images only, never photos of cast members", async () => {
    apiHolds();
    const { wrapper } = await openAppAt(pageOf("wardrobe"));

    expect(wrapper.get("main [data-test=upload-area]").text()).toContain(
      "Costume designs and images only: no photos of cast members.",
    );
  });

  it("downloads an MP3 rather than playing it", async () => {
    vi.mocked(openFileTab).mockReset();
    vi.mocked(downloadFrom).mockReset();
    apiHolds({ wardrobe: { "opening-number": [{ name: "thunder.mp3", size: 10 }] } });
    const { wrapper } = await openAppAt(pageOf("wardrobe"));

    await rowFor(wrapper, "thunder.mp3").get(".file-open").trigger("click");
    await flushPromises();

    expect(downloadFrom).toHaveBeenCalledWith(linkTo("thunder.mp3"));
    expect(openFileTab).not.toHaveBeenCalled();
  });

  const singer = aRole(9, "campfire-song", [kimLee.id], { name: "Singer", size: "lead" });
  const casting = { roles: [pirates, captainHook(), singer], cast: pirateCast };

  const costumeRows = (wrapper: VueWrapper) =>
    wrapper.findAll("main [data-test=costume]").map((row) => row.text().replace(/\s+/g, " "));

  it("lists who wears what from the item's casting, a row per cast member per role", async () => {
    apiHolds({}, [], casting);
    const { wrapper } = await openAppAt(pageOf("wardrobe"));

    expect(costumeRows(wrapper)).toEqual([
      "Captain Hook (Alex Morgan)",
      "Pirates (Jo Brown)",
      "Pirates (Kim Lee)",
      "Pirates (Sam Patel)",
    ]);
  });

  it("shows the casting as it is now, so a recast role shows its new cast member", async () => {
    apiHolds({}, [], { roles: [captainHook()], cast: pirateCast });
    const first = await openAppAt(pageOf("wardrobe"));
    first.wrapper.unmount();

    // Recast on the casting page meanwhile.
    apiHolds({}, [], { roles: [captainHook(chrisEvans)], cast: pirateCast });
    const { wrapper } = await openAppAt(pageOf("wardrobe"));

    expect(costumeRows(wrapper)).toEqual(["Captain Hook (Chris Evans)"]);
    expect(wrapper.get("main section[aria-labelledby=costumes-heading]").text()).not.toContain(
      "Alex Morgan",
    );
  });

  it("shows the next item's own rows after Next, keeping All items, Previous and Next", async () => {
    apiHolds({}, [], casting);
    const { wrapper } = await openAppAt(pageOf("wardrobe"));

    await wrapper.get("main a[rel=next]").trigger("click");
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Wardrobe: Campfire Song");
    expect(costumeRows(wrapper)).toEqual(["Singer (Kim Lee)"]);
    const nav = wrapper.get("main nav[aria-label='Item navigation']");
    expect(nav.get("a").text()).toBe("All items");
    expect(nav.get("a[rel=prev]").attributes("href")).toBe(pageOf("wardrobe"));
    expect(nav.get("a[rel=next]").attributes("href")).toBe(pageOf("wardrobe", "finale"));
  });

  it("shows each row's saved costume to anyone signed in, with nothing to change it", async () => {
    await signInAs([], "jo");
    apiHolds({}, [], casting, [alexAsHook]);
    const { wrapper } = await openAppAt(pageOf("wardrobe"));

    expect(costumeFieldsOf(wrapper.get("main [data-test=costume]"))).toEqual([
      ["From Wardrobe", "Red coat, hook"],
      ["From Cast Member", "Black shoes"],
      ["Notes", "Hem the coat"],
    ]);
    expect(wrapper.find("main [data-test=costume] button").exists()).toBe(false);
  });

  it("saves a costume, which anyone opening the page later sees", async () => {
    const costumes: Costume[] = [];
    apiHolds({}, [], casting, costumes);
    const first = await openAppAt(pageOf("wardrobe"));
    await first.wrapper
      .get("main button[aria-label='Edit Alex Morgan as Captain Hook']")
      .trigger("click");
    const form = first.wrapper.get("main form[aria-label='Edit Alex Morgan as Captain Hook']");
    await costumeFormField(form, "From Wardrobe").setValue("Red coat, hook");
    await costumeFormField(form, "From Cast Member").setValue("Black shoes");
    await costumeFormField(form, "Notes").setValue("Hem the coat");
    await form.trigger("submit");
    await flushPromises();
    first.wrapper.unmount();

    await signInAs([], "jo");
    const { wrapper } = await openAppAt(pageOf("wardrobe"));

    expect(costumes).toEqual([alexAsHook]);
    expect(costumeFieldsOf(wrapper.get("main [data-test=costume]"))).toEqual([
      ["From Wardrobe", "Red coat, hook"],
      ["From Cast Member", "Black shoes"],
      ["Notes", "Hem the coat"],
    ]);
  });

  it.each([
    ["kit, with Wardrobe", "wardrobe"],
    ["dee, with Director", "director"],
    ["ann, an admin", "admin"],
  ])("gives %s a pencil on every cast row", async (_who, group) => {
    await signInAs([group], "made-up");
    apiHolds({}, [], casting);
    const { wrapper } = await openAppAt(pageOf("wardrobe"));

    expect(wrapper.findAll("main [data-test=costume] [data-test=edit]")).toHaveLength(4);
  });

  it("gives lee, with Tech only, no pencils", async () => {
    await signInAs(["tech"], "lee");
    apiHolds({}, [], casting);
    const { wrapper } = await openAppAt(pageOf("wardrobe"));

    expect(wrapper.find("main [data-test=costume] [data-test=edit]").exists()).toBe(false);
  });
});
