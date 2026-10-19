import type { CastMember, Role } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "../App.vue";
import { CAST_PATH } from "../cast.ts";
import { documentXml, outline, readDocx } from "../docx.fixture.ts";
import { ROLES_PATH } from "../roles.ts";
import { createAppRouter } from "../router.ts";
import { anItem, aRunningOrder } from "../running-order.fixture.ts";
import { RUNNING_ORDER_PATH } from "../running-order.ts";
import { signInAs } from "../sign-in.fixture.ts";
import { useLocalSignIn } from "../sign-in.ts";

// The Overview's Word exports (casting-overview-by-item E2, ADR 0022). Made-up names only:
// tests never use the real cast (CLAUDE.md safeguarding).

enableAutoUnmount(afterEach);

const member = (id: number, firstName: string, lastName: string): CastMember => ({
  id,
  firstName,
  lastName,
  section: "scouts",
  group: "",
  // Casting notes are never exported (ADR 0014).
  singing: "Strong alto voice",
  acting: "Confident on stage",
  revision: 1,
});
const ava = member(1, "Ava", "Example");
const ben = member(2, "Ben", "Sample");
const show = aRunningOrder([anItem("Opening")], [anItem("Finale")]);
const fairy: Role = {
  id: 1,
  itemId: "opening",
  name: "Fairy Godmother",
  size: "lead",
  castMemberIds: [ava.id],
  revision: 1,
};

/** The stand-in API: what it answers can change between the page loading and the export. */
let api: { cast: CastMember[]; roles: Role[]; rolesStatus: number; holdRoles?: Promise<void> };
let saved: { name: string; file: Blob }[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2027, 2, 12, 10, 0) });
  useLocalSignIn();
  api = { cast: [ava, ben], roles: [fairy], rolesStatus: 200 };
  saved = [];
  let lastFile: Blob | undefined;
  URL.createObjectURL = vi.fn((file: Blob) => {
    lastFile = file;
    return "blob:made-up";
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (lastFile) saved.push({ name: this.download, file: lastFile });
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === ROLES_PATH) {
        await api.holdRoles;
        return api.rolesStatus === 200
          ? new Response(JSON.stringify({ productionId: "2027", roles: api.roles }))
          : new Response(null, { status: api.rolesStatus });
      }
      if (url === CAST_PATH) {
        return new Response(JSON.stringify({ productionId: "2027", members: api.cast }));
      }
      if (url === RUNNING_ORDER_PATH) return new Response(JSON.stringify(show));
      return new Response(JSON.stringify({ status: "ok", version: "dev" }));
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

async function openView(label: "By person" | "By item" | "Grid") {
  const router = createAppRouter(createMemoryHistory());
  await router.push("/casting/overview");
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  await wrapper
    .findAll(".view-switch button")
    .find((b) => b.text() === label)
    ?.trigger("click");
  return wrapper;
}

const buttonNamed = (wrapper: VueWrapper, label: string) =>
  wrapper.findAll("main button").find((b) => b.text() === label);

async function exportFrom(wrapper: VueWrapper, label: string) {
  await buttonNamed(wrapper, label)?.trigger("click");
  await flushPromises();
  // Building the document is real work in the browser: let it finish.
  await vi.waitFor(() =>
    expect(saved.length > 0 || wrapper.find("[role=alert]").exists()).toBe(true),
  );
  await flushPromises();
}

const bytesOf = async (file: Blob | undefined) =>
  new Uint8Array(file ? await file.arrayBuffer() : new ArrayBuffer(0));

describe("Export to Word", () => {
  it("sits beside the view switch on the By item view, in blue, with a file icon", async () => {
    const wrapper = await openView("By item");

    const button = buttonNamed(wrapper, "Export to Word");
    expect(button?.classes()).toContain("word-export-button");
    expect(button?.find("svg").exists()).toBe(true);
    expect(wrapper.get(".view-bar").find("button.word-export-button").exists()).toBe(true);
    expect(wrapper.find(".view-switch button.word-export-button").exists()).toBe(false);
  });

  it("isn't on the Grid view, which exports to Excel", async () => {
    const wrapper = await openView("Grid");

    expect(buttonNamed(wrapper, "Export to Word")).toBeUndefined();
    expect(buttonNamed(wrapper, "Export to Excel")).toBeDefined();
  });

  it.each([["admin"], ["casting"], ["read-only"]])("lets %s export", async (group) => {
    await signInAs([group]);
    const wrapper = await openView("By item");

    await exportFrom(wrapper, "Export to Word");

    expect(saved).toHaveLength(1);
  });

  it("names the file for the production and the day", async () => {
    const wrapper = await openView("By item");

    await exportFrom(wrapper, "Export to Word");

    expect(saved.map(({ name }) => name)).toEqual(["Gang Show 2027 item overview 2027-03-12.docx"]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:made-up");
  });

  it("holds what the By item view shows, as headings and a roles table", async () => {
    const wrapper = await openView("By item");

    await exportFrom(wrapper, "Export to Word");

    const blocks = readDocx(await bytesOf(saved[0]?.file));
    expect(outline(blocks)).toEqual([
      "Heading1: Gang Show 2027",
      "Heading2: First half",
      "Heading3: 1 Opening",
      "Heading2: Second half",
      "Heading3: 1 Finale",
      "-: No roles have been added yet.",
    ]);
    expect(blocks.find((block) => block.kind === "table")).toMatchObject({
      rows: [
        { header: true, cells: ["Role name", "Role type", "Cast"] },
        { header: false, cells: ["Fairy Godmother", "Lead", "Ava Example"] },
      ],
    });
  });

  it("holds nothing about the cast beyond their names", async () => {
    const wrapper = await openView("By item");

    await exportFrom(wrapper, "Export to Word");

    const xml = documentXml(await bytesOf(saved[0]?.file));
    expect(xml).not.toContain("Strong alto voice");
    expect(xml).not.toContain("Confident on stage");
  });

  it("includes a role added since the page opened", async () => {
    const wrapper = await openView("By item");
    api.roles = [
      fairy,
      { ...fairy, id: 2, itemId: "finale", name: "Narrator", castMemberIds: [ben.id] },
    ];

    await exportFrom(wrapper, "Export to Word");

    const tables = readDocx(await bytesOf(saved[0]?.file)).filter(
      (block) => block.kind === "table",
    );
    expect(tables.map((table) => table.rows[1]?.cells)).toEqual([
      ["Fairy Godmother", "Lead", "Ava Example"],
      ["Narrator", "Lead", "Ben Sample"],
    ]);
  });

  it("shows it's busy and starts no second export while one is being made", async () => {
    const wrapper = await openView("By item");
    let release = () => {};
    api.holdRoles = new Promise((resolve) => {
      release = resolve;
    });

    await buttonNamed(wrapper, "Export to Word")?.trigger("click");
    const button = wrapper.get<HTMLButtonElement>("button.word-export-button");
    expect(button.attributes("disabled")).toBeDefined();
    await button.trigger("click");
    release();
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    await flushPromises();

    expect(saved).toHaveLength(1);
    expect(button.attributes("disabled")).toBeUndefined();
  });

  it("puts keyboard focus back on the button when the export is over", async () => {
    const wrapper = await openView("By item");
    const button = wrapper.get<HTMLButtonElement>("button.word-export-button");
    button.element.focus();

    await exportFrom(wrapper, "Export to Word");

    expect(document.activeElement).toBe(button.element);
  });

  it("announces a finished export to screen readers", async () => {
    const wrapper = await openView("By item");

    await exportFrom(wrapper, "Export to Word");

    expect(wrapper.get("[data-test=announcement]").text()).toBe("Item overview exported.");
  });

  it("says the export didn't work, saving no file, and lets the user try again", async () => {
    const wrapper = await openView("By item");
    api.rolesStatus = 500;

    await exportFrom(wrapper, "Export to Word");

    expect(wrapper.get(".word-export-error").text()).toBe(
      "Couldn't export the item overview. Try again.",
    );
    expect(saved).toEqual([]);

    api.rolesStatus = 200;
    await exportFrom(wrapper, "Export to Word");

    expect(wrapper.find(".word-export-error").exists()).toBe(false);
    expect(saved).toHaveLength(1);
  });

  it("forgets a failed export once the user moves to another view", async () => {
    const wrapper = await openView("By item");
    api.rolesStatus = 500;
    await exportFrom(wrapper, "Export to Word");

    for (const label of ["Grid", "By item"]) {
      await wrapper
        .findAll(".view-switch button")
        .find((b) => b.text() === label)
        ?.trigger("click");
    }

    expect(wrapper.find(".word-export-error").exists()).toBe(false);
  });
});

describe("Export to Word on the By person view: the Casting Sheets", () => {
  it("sits beside the view switch on the By person view, in blue, with a file icon", async () => {
    const wrapper = await openView("By person");

    const button = buttonNamed(wrapper, "Export to Word");
    expect(button?.classes()).toContain("word-export-button");
    expect(button?.find("svg").exists()).toBe(true);
    expect(wrapper.get(".view-bar").find("button.word-export-button").exists()).toBe(true);
    expect(wrapper.find(".view-switch button.word-export-button").exists()).toBe(false);
  });

  it.each([
    ["By person", "Gang Show 2027 casting sheets 2027-03-12.docx"],
    ["By item", "Gang Show 2027 item overview 2027-03-12.docx"],
  ] as const)("makes the %s view's own document", async (view, name) => {
    const wrapper = await openView(view);

    await exportFrom(wrapper, "Export to Word");

    expect(saved.map((file) => file.name)).toEqual([name]);
  });

  it.each([["admin"], ["casting"], ["read-only"]])("lets %s export", async (group) => {
    await signInAs([group]);
    const wrapper = await openView("By person");

    await exportFrom(wrapper, "Export to Word");

    expect(saved).toHaveLength(1);
  });

  it("has a page for everyone in the cast, including people in nothing yet", async () => {
    const wrapper = await openView("By person");

    await exportFrom(wrapper, "Export to Word");

    const names = readDocx(await bytesOf(saved[0]?.file)).flatMap((block) =>
      block.kind === "paragraph" && block.style === "Heading2" ? [block.text] : [],
    );
    expect(names).toEqual(["Ava Example", "Ben Sample"]);
  });

  it("holds nothing about the cast beyond name, section and group", async () => {
    const wrapper = await openView("By person");

    await exportFrom(wrapper, "Export to Word");

    const xml = documentXml(await bytesOf(saved[0]?.file));
    expect(xml).not.toContain("Strong alto voice");
    expect(xml).not.toContain("Confident on stage");
  });

  it("announces a finished export to screen readers", async () => {
    const wrapper = await openView("By person");

    await exportFrom(wrapper, "Export to Word");

    expect(wrapper.get("[data-test=announcement]").text()).toBe("Casting sheets exported.");
  });

  it("shows it's busy while the sheets are made, then gives focus back", async () => {
    const wrapper = await openView("By person");
    const button = wrapper.get<HTMLButtonElement>("button.word-export-button");
    button.element.focus();
    let release = () => {};
    api.holdRoles = new Promise((resolve) => {
      release = resolve;
    });

    await button.trigger("click");
    expect(button.attributes("disabled")).toBeDefined();
    await button.trigger("click");
    release();
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    await flushPromises();

    expect(saved).toHaveLength(1);
    expect(button.attributes("disabled")).toBeUndefined();
    expect(document.activeElement).toBe(button.element);
  });

  it("isn't offered while the cast is empty", async () => {
    api.cast = [];

    const wrapper = await openView("By person");

    expect(wrapper.text()).toContain("No cast members yet.");
    expect(buttonNamed(wrapper, "Export to Word")).toBeUndefined();
  });

  it("says the export didn't work, saving no file", async () => {
    const wrapper = await openView("By person");
    api.rolesStatus = 500;

    await exportFrom(wrapper, "Export to Word");

    expect(wrapper.get(".word-export-error").text()).toBe(
      "Couldn't export the casting sheets. Try again.",
    );
    expect(saved).toEqual([]);
    expect(buttonNamed(wrapper, "Export to Word")?.attributes("disabled")).toBeUndefined();
  });
});
