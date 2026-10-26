import type { CastMember, Prop, Role } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "@/App.vue";
import { createAppRouter } from "@/router/index.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { CAST_PATH } from "@/utils/cast.ts";
import { PROPS_PATH } from "@/utils/props.ts";
import { PROPS_NOTES_PATH } from "@/utils/props-notes.ts";
import { ROLES_PATH } from "@/utils/roles.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";
import { RUNNING_ORDER_PATH } from "@/utils/running-order.ts";
import { documentXml, readDocx } from "@/utils/word/docx.fixture.ts";

// The Stage page's Generate Props List button (stage-props FR22, FR23; ADR 0022). Made-up
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
const telescope: Prop = { id: 1, itemId: "pirate-sketch", name: "Telescope", roleIds: [1] };

/** The stand-in API: what it answers can change between the page loading and the export. */
let api: {
  cast: CastMember[];
  roles: Role[];
  propsStatus: number;
  holdProps?: Promise<void>;
};
let saved: { name: string; file: Blob }[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 25, 10, 0) });
  useLocalSignIn();
  api = { cast: [sam, kim], roles: [captain], propsStatus: 200 };
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
  const json = (body: unknown) => new Response(JSON.stringify(body));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === PROPS_PATH) {
        await api.holdProps;
        return api.propsStatus === 200
          ? json({ productionId: "2027", props: [telescope] })
          : new Response(null, { status: api.propsStatus });
      }
      if (url === PROPS_NOTES_PATH) return json({ productionId: "2027", notes: [] });
      if (url === ROLES_PATH) return json({ productionId: "2027", roles: api.roles });
      if (url === CAST_PATH) return json({ productionId: "2027", members: api.cast });
      if (url === RUNNING_ORDER_PATH) return json(show);
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

async function openPropsView() {
  const router = createAppRouter(createMemoryHistory());
  await router.push("/production/stage?view=props");
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

const generateButton = (wrapper: VueWrapper) =>
  wrapper.findAll("main button").find((b) => b.text() === "Generate Props List");

async function generate(wrapper: VueWrapper) {
  await generateButton(wrapper)?.trigger("click");
  await flushPromises();
  // Building the document is real work in the browser: let it finish.
  await vi.waitFor(() =>
    expect(saved.length > 0 || wrapper.find(".word-export-error").exists()).toBe(true),
  );
  await flushPromises();
}

const bytesOf = async (file: Blob | undefined) =>
  new Uint8Array(file ? await file.arrayBuffer() : new ArrayBuffer(0));

const exportUses = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([url, init]) => url === "/api/usage" && init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init?.body)))
    .filter((body) => body.event === "export");

describe("Generate Props List", () => {
  it("lets someone with no permissions download the props list as a Word document", async () => {
    await signInAs([], "jo");
    const wrapper = await openPropsView();

    expect(generateButton(wrapper)?.classes()).toContain("word-export-button");
    await generate(wrapper);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toMatch(/\.docx$/);
  });

  it("names the file for the production and the day, as the Item Overview is", async () => {
    const wrapper = await openPropsView();

    await generate(wrapper);

    expect(saved.map(({ name }) => name)).toEqual(["Gang Show 2027 props list 2026-10-25.docx"]);
  });

  it("shows the cast as saved when it's generated, not when the page loaded", async () => {
    const wrapper = await openPropsView();
    api.roles = [{ ...captain, castMemberIds: [kim.id] }];

    await generate(wrapper);

    const table = readDocx(await bytesOf(saved[0]?.file)).find((block) => block.kind === "table");
    expect(table?.kind === "table" ? table.rows[1]?.cells : undefined).toEqual([
      "Telescope",
      "Captain",
      "Kim Lee",
    ]);
  });

  it("holds nothing about the cast beyond their names", async () => {
    const wrapper = await openPropsView();

    await generate(wrapper);

    const xml = documentXml(await bytesOf(saved[0]?.file));
    expect(xml).toContain("Sam Taylor");
    for (const detail of ["Strong alto voice", "Confident on stage", "Made-up Explorer Unit"]) {
      expect(xml).not.toContain(detail);
    }
    expect(xml).not.toMatch(/explorers/i);
  });

  it("says the props list was generated, and records the use", async () => {
    const wrapper = await openPropsView();

    await generate(wrapper);

    expect(wrapper.get("[data-test=announcement]").text()).toBe("Props list generated.");
    expect(exportUses()).toEqual([{ event: "export", export: "word-props-list" }]);
  });

  it("shows it's busy and starts no second list while one is being made", async () => {
    const wrapper = await openPropsView();
    let release = () => {};
    api.holdProps = new Promise((resolve) => {
      release = resolve;
    });

    const button = wrapper.get<HTMLButtonElement>("button.word-export-button");
    await button.trigger("click");
    expect(button.attributes("disabled")).toBeDefined();
    await button.trigger("click");
    release();
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    await flushPromises();

    expect(saved).toHaveLength(1);
    expect(button.attributes("disabled")).toBeUndefined();
  });

  it("says when it can't be made, saving and recording nothing, and keeps the button ready", async () => {
    const wrapper = await openPropsView();
    api.propsStatus = 500;

    await generate(wrapper);

    expect(wrapper.get(".word-export-error").text()).toBe(
      "Couldn't generate the props list. Try again.",
    );
    expect(saved).toEqual([]);
    expect(exportUses()).toEqual([]);
    expect(generateButton(wrapper)?.attributes("disabled")).toBeUndefined();

    api.propsStatus = 200;
    await generate(wrapper);

    expect(wrapper.find(".word-export-error").exists()).toBe(false);
    expect(saved).toHaveLength(1);
  });
});
