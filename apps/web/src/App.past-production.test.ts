import type { CastMember, Prop, Role } from "@app/shared";
import { PAST_PRODUCTION_REFUSAL, pastProductionRefusal } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "@/App.vue";
import { createAppRouter } from "@/router/index.ts";
import { openProduction } from "@/services/production.ts";
import { chooseLocalAccess, useLocalSignIn } from "@/services/sign-in.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";

// Made-up names only: tests never use the real cast (CLAUDE.md safeguarding).

enableAutoUnmount(afterEach);
let saved: { name: string; file: Blob }[];

beforeEach(() => {
  useLocalSignIn();
  // As when the app has just started: no production chosen yet.
  openProduction(undefined);
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
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const member: CastMember = {
  id: 1,
  firstName: "Ava",
  lastName: "Example",
  section: "scouts",
  group: "",
  singing: "",
  acting: "",
  revision: 1,
};
const role: Role = {
  id: 1,
  itemId: "opening-number",
  name: "Pirate",
  size: "lead",
  castMemberIds: [member.id],
  revision: 1,
};
const prop: Prop = {
  id: 1,
  itemId: "opening-number",
  name: "Treasure chest",
  quantity: 1,
  roleIds: [],
  carrierIds: [],
};

const answer = (productionId: string, last: string): unknown => {
  if (last.endsWith("-counts")) return { counts: {} };
  if (last.endsWith("-files")) return { files: [] };
  if (last.endsWith("notes")) return { productionId, notes: [] };
  const answers: Record<string, unknown> = {
    "running-order": {
      ...aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]),
      productionId,
      title: `Gang Show ${productionId}`,
    },
    cast: { productionId, members: [member] },
    roles: { productionId, roles: [role] },
    props: { productionId, props: [prop] },
    "mic-plot": { productionId, items: [] },
  };
  return answers[last] ?? { status: "ok", version: "1.2.3" };
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A stand-in API holding productions 2027 and 2028, keeping every request made of it. */
function serveProductions({ productions = ["2027", "2028"] } = {}) {
  const requests: { url: string; method: string }[] = [];
  const api = { refusal: undefined as Response | undefined };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requests.push({ url, method });
      if (url === "/api/productions") return json({ productions });
      if (method !== "GET" && api.refusal) return api.refusal;
      if (url.endsWith("/casting-grid/export")) return new Response(new Blob(["grid"]));
      const year = /\/productions\/(\d{4})\//.exec(url)?.[1] ?? "";
      return json(answer(year, url.split("/").at(-1) ?? ""));
    }),
  );
  return { requests, api };
}

async function open(path: string) {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return { wrapper, router };
}

const yearShown = (wrapper: VueWrapper) => wrapper.get("[data-test=production-year]").text();

async function switchTo(wrapper: VueWrapper, year: string) {
  await wrapper.get("[data-test=production-switch] select").setValue(year);
  await wrapper.get("[data-test=production-switch]").trigger("submit");
  await flushPromises();
}

async function goTo(
  wrapper: VueWrapper,
  router: Awaited<ReturnType<typeof open>>["router"],
  path: string,
) {
  await router.push(path);
  await flushPromises();
  return wrapper;
}

describe("switching production", () => {
  it("shows jo, with no permissions, 2027's pages and the sidebar's 2027", async () => {
    const { requests } = serveProductions();
    chooseLocalAccess([]);
    const { wrapper } = await open("/cast");

    await switchTo(wrapper, "2027");

    expect(yearShown(wrapper)).toBe("Gang Show 2027");
    expect(requests.map(({ url }) => url)).toContain("/api/productions/2027/running-order");
  });

  it("takes them to the Running order, which is in every production", async () => {
    serveProductions();
    const { wrapper, router } = await open("/casting/items/opening-number");

    await switchTo(wrapper, "2027");

    expect(router.currentRoute.value.name).toBe("running-order");
  });

  it("shows the newest again on choosing it", async () => {
    const { requests } = serveProductions();
    const { wrapper, router } = await open("/cast");
    await switchTo(wrapper, "2027");
    await goTo(wrapper, router, "/cast");
    requests.length = 0;

    await switchTo(wrapper, "2028");

    expect(yearShown(wrapper)).toBe("Gang Show 2028");
    expect(requests.map(({ url }) => url)).toContain("/api/productions/2028/running-order");
    await goTo(wrapper, router, "/cast");
    expect(wrapper.find("[data-test=view-only]").exists()).toBe(false);
    expect(wrapper.find("[data-test=add-member]").exists()).toBe(true);
  });

  it("offers the productions newest first, with the open one chosen", async () => {
    serveProductions({ productions: ["2027", "2029", "2028"] });
    const { wrapper } = await open("/");

    const select = wrapper.get<HTMLSelectElement>("[data-test=production-switch] select");

    expect(select.findAll("option").map((option) => option.text())).toEqual([
      "2029",
      "2028",
      "2027",
    ]);
    expect(select.element.value).toBe("2029");
  });

  it("isn't offered while there's only one production", async () => {
    serveProductions({ productions: ["2027"] });
    const { wrapper } = await open("/");

    expect(wrapper.find("[data-test=production-switch]").exists()).toBe(false);
  });

  it("goes back to the newest when the app next opens", async () => {
    serveProductions();
    const first = await open("/");
    await switchTo(first.wrapper, "2027");
    first.wrapper.unmount();

    openProduction(undefined);
    const { wrapper } = await open("/");

    expect(yearShown(wrapper)).toBe("Gang Show 2028");
  });

  it("stays put if they decide to keep unsaved changes", async () => {
    const { requests } = serveProductions();
    vi.stubGlobal("confirm", () => false);
    const { wrapper } = await open("/running-order");
    await wrapper.get("button[data-move=down]").trigger("click");
    requests.length = 0;

    await switchTo(wrapper, "2027");

    expect(yearShown(wrapper)).toBe("Gang Show 2028");
    expect(wrapper.find("[data-test=unsaved]").exists()).toBe(true);
    expect(requests.map(({ url }) => url)).not.toContain("/api/productions/2027/running-order");
  });

  describe("by keyboard", () => {
    it("is a labelled drop-down and a button, which a keyboard can reach and use", async () => {
      serveProductions();
      const { wrapper } = await open("/");
      const form = wrapper.get("form[data-test=production-switch]");

      const select = form.get("select");
      expect(form.get(`label[for="${select.attributes("id")}"]`).text()).toBe("Productions");
      expect(form.get("button[type=submit]").text()).toBe("Open");
      expect(select.attributes("tabindex")).toBeUndefined();

      select.element.focus();
      expect(document.activeElement).toBe(select.element);
    });
  });
});

describe("a past production, as an admin", () => {
  // The page, and a control the same admin has on the newest: proof it's the past that hides it.
  it.each([
    ["Cast", "/cast", "[data-test=add-member]"],
    ["Running order", "/running-order", "[data-add-to]"],
    ["an item's Casting page", "/casting/items/opening-number", "[data-test=add-role]"],
    ["an item's Props page", "/production/items/opening-number/props", "[data-test=add-prop]"],
    [
      "an item's Scenery page",
      "/production/items/opening-number/scenery",
      "[data-test=upload-input]",
    ],
    ["an item's SFX page", "/production/items/opening-number/sfx", "[data-test=upload-input]"],
    [
      "an item's Wardrobe page",
      "/production/items/opening-number/wardrobe",
      "[data-test=upload-input]",
    ],
    [
      "an item's Mic plot page",
      "/production/items/opening-number/mic-plot",
      "[data-test=mic] button",
    ],
  ])("shows %s as View only, with no controls to change it", async (_page, path, control) => {
    serveProductions();
    const newest = await open(path);
    expect(newest.wrapper.find(control).exists()).toBe(true);
    expect(newest.wrapper.find("[data-test=view-only]").exists()).toBe(false);
    newest.wrapper.unmount();

    openProduction(undefined);
    const { wrapper, router } = await open("/");
    await switchTo(wrapper, "2027");
    await goTo(wrapper, router, path);

    expect(wrapper.get("[data-test=view-only]").text()).toBe("View only");
    expect(wrapper.find(control).exists()).toBe(false);
    expect(wrapper.find("main textarea").exists()).toBe(false);
    expect(wrapper.find("main .row-icons button").exists()).toBe(false);
  });

  it.each([
    ["the Casting Overview", "/casting/overview"],
    ["Casting Items", "/casting/items"],
    ["the Production overview", "/production/overview"],
  ])("shows %s as View only", async (_page, path) => {
    serveProductions();
    const { wrapper, router } = await open("/");
    await switchTo(wrapper, "2027");

    await goTo(wrapper, router, path);

    expect(wrapper.get("[data-test=view-only]").text()).toBe("View only");
  });

  it("shows the Production overview without the badge on the newest", async () => {
    serveProductions();
    const { wrapper } = await open("/production/overview");

    expect(wrapper.find("[data-test=view-only]").exists()).toBe(false);
  });

  it("offers its departments' pages on the Production overview to view, not to edit", async () => {
    serveProductions();
    const { wrapper, router } = await open("/");
    await switchTo(wrapper, "2027");

    await goTo(wrapper, router, "/production/overview");

    expect(wrapper.find("main a[aria-label^='View props']").exists()).toBe(true);
    expect(wrapper.find("main a[aria-label^='Edit']").exists()).toBe(false);
  });

  it("offers nothing on the Productions page that could reopen it, and can still start one", async () => {
    serveProductions();
    const { wrapper, router } = await open("/");
    await switchTo(wrapper, "2027");

    await goTo(wrapper, router, "/productions");

    expect(wrapper.find("[data-test=view-only]").exists()).toBe(false);
    const buttons = wrapper.findAll("main button").map((button) => button.text());
    expect(buttons.filter((name) => !["Help", "Close"].includes(name))).toEqual(["Add production"]);
  });

  it("goes view only when the API says a newer one started while it was open", async () => {
    const { api } = serveProductions();
    const { wrapper } = await open("/cast");
    expect(wrapper.find("[data-test=add-member]").exists()).toBe(true);
    api.refusal = json(pastProductionRefusal(["2027", "2028", "2029"]), 403);

    await wrapper.get("[data-test=edit]").trigger("click");
    await wrapper.get("form[data-test=cast-member-form]").trigger("submit");
    await flushPromises();

    expect(wrapper.get("[data-test=view-only]").text()).toBe("View only");
    expect(wrapper.find("[data-test=add-member]").exists()).toBe(false);
    expect(yearShown(wrapper)).toBe("Gang Show 2028");
    const options = wrapper.findAll("[data-test=production-switch] option");
    expect(options.map((option) => option.text())).toEqual(["2029", "2028", "2027"]);
  });
});

describe("saving the running order when a newer production has started", () => {
  it("says it's a past production, not that only admins can save", async () => {
    const { api } = serveProductions();
    const { wrapper } = await open("/running-order");
    await wrapper.get("button[data-move=down]").trigger("click");
    api.refusal = json(pastProductionRefusal(["2027", "2028", "2029"]), 403);

    await wrapper.get("[data-test=save]").trigger("click");
    await flushPromises();

    expect(wrapper.get(".notice").text()).toBe(PAST_PRODUCTION_REFUSAL);
  });
});

describe("exports from a past production", () => {
  const buttonNamed = (wrapper: VueWrapper, name: string) =>
    wrapper.findAll("main button").find((button) => button.text().includes(name));

  it("makes the Excel casting grid from 2027", async () => {
    const { requests } = serveProductions();
    const { wrapper, router } = await open("/");
    await switchTo(wrapper, "2027");
    await goTo(wrapper, router, "/casting/overview");
    await buttonNamed(wrapper, "Grid")?.trigger("click");
    await flushPromises();

    await buttonNamed(wrapper, "Export to Excel")?.trigger("click");
    await vi.waitFor(() => expect(saved.length).toBeGreaterThan(0));

    expect(requests).toContainEqual({
      url: "/api/productions/2027/casting-grid/export",
      method: "POST",
    });
    expect(saved.map(({ name }) => name).join()).toContain("2027");
  });

  it.each([
    ["Word props list", "Generate Props List", "props"],
    ["Mic Plot", "Generate Mic Plot", "mic-plot"],
  ])("makes the %s from 2027's data", async (_export, button, source) => {
    const { requests } = serveProductions();
    const { wrapper, router } = await open("/");
    await switchTo(wrapper, "2027");
    await goTo(wrapper, router, "/production/overview");

    await buttonNamed(wrapper, button)?.trigger("click");
    await vi.waitFor(() => expect(saved.length).toBeGreaterThan(0));

    expect(requests.map(({ url }) => url)).toContain(`/api/productions/2027/${source}`);
    expect(requests.map(({ url }) => url)).not.toContain(`/api/productions/2028/${source}`);
    expect(saved.map(({ name }) => name).join()).toContain("2027");
  });
});
