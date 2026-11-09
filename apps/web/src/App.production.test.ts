import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "@/App.vue";
import { createAppRouter } from "@/router/index.ts";
import { chooseLocalAccess, signInNeeded, useLocalSignIn } from "@/services/sign-in.ts";
import { openProduction } from "@/utils/production.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";

enableAutoUnmount(afterEach);
beforeEach(() => {
  useLocalSignIn();
  // As when the app has just started: no production chosen yet.
  openProduction(undefined);
});
afterEach(() => vi.unstubAllGlobals());

const PRODUCTIONS = "/api/productions";
const NEWEST = `${PRODUCTIONS}/2028`;
// The app's own requests, which belong to no production.
const NOT_ABOUT_A_PRODUCTION = [PRODUCTIONS, "/api/health", "/api/usage"];

const productionId = "2028";
const answers: Record<string, unknown> = {
  "running-order": {
    ...aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]),
    productionId,
  },
  cast: { productionId, members: [] },
  roles: { productionId, roles: [] },
  props: { productionId, props: [] },
  "mic-plot": { productionId, items: [] },
};

/** A stand-in API holding productions 2027 and 2028, keeping every request the page makes. */
function serveProductions(list: () => Response = () => json({ productions: ["2027", "2028"] })) {
  const requests: { url: string; body: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, body: String(init?.body ?? "") });
      if (url === PRODUCTIONS) return list();
      const last = url.split("/").at(-1) ?? "";
      if (last.endsWith("-counts")) return json({ counts: {} });
      if (last.endsWith("notes")) return json({ productionId, notes: [] });
      return json(answers[last] ?? { status: "ok", version: "1.2.3" });
    }),
  );
  return requests;
}

const json = (body: unknown) => new Response(JSON.stringify(body));

async function open(path: string) {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

describe("the app with productions 2027 and 2028", () => {
  it.each([
    ["Cast", "/cast", ["cast"]],
    ["Running order", "/running-order", ["running-order"]],
    ["Casting Items", "/casting/items", ["running-order", "roles", "cast", "item-notes"]],
    ["an item's Casting page", "/casting/items/opening-number", ["running-order", "roles", "cast"]],
    [
      "the Production overview",
      "/production/overview",
      ["running-order", "props", "mic-plot", "scenery-file-counts", "props-notes"],
    ],
  ])("opens the newest, asking only for 2028, on %s", async (_page, path, expected) => {
    const requests = serveProductions();

    await open(path);

    const urls = requests.map(({ url }) => url);
    expect(urls.filter((url) => !url.startsWith(`${NEWEST}/`))).toEqual(
      urls.filter((url) => NOT_ABOUT_A_PRODUCTION.includes(url)),
    );
    expect(urls).toEqual(expect.arrayContaining(expected.map((rest) => `${NEWEST}/${rest}`)));
    const visits = requests.filter(({ url }) => url === "/api/usage").map(({ body }) => body);
    for (const visit of visits) expect(visit).not.toContain("2027");
  });

  it.each([
    ["the Welcome page", "/"],
    ["Cast", "/cast"],
    ["an item's Props page", "/production/items/opening-number/props"],
  ])("shows the year 2028 in the sidebar on %s", async (_page, path) => {
    serveProductions();

    const wrapper = await open(path);

    expect(wrapper.get(".sidebar [data-test=production-year]").text()).toBe("Gang Show 2028");
  });

  it("lets pat, with Stage, change the props and view the cast in 2028, as in 2027", async () => {
    serveProductions();
    chooseLocalAccess(["stage"]);

    const props = await open("/production/items/opening-number/props");
    expect(props.find("[data-test=add-prop]").exists()).toBe(true);
    expect(props.find("[data-test=view-only]").exists()).toBe(false);
    props.unmount();

    const cast = await open("/cast");
    expect(cast.get("[data-test=view-only]").text()).toBe("View only");
    expect(cast.find("[data-test=add-member]").exists()).toBe(false);
  });

  it("says so, in place of the page, when the list can't be loaded", async () => {
    const requests = serveProductions(() => new Response(null, { status: 500 }));

    const wrapper = await open("/cast");

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the productions.");
    expect(wrapper.find("[data-test=production-year]").exists()).toBe(false);
    expect(requests.map(({ url }) => url)).not.toContain(`${NEWEST}/cast`);
  });

  it("asks for the list only once someone has signed in", async () => {
    const requests = serveProductions();
    signInNeeded.value = true;

    const wrapper = await open("/cast");
    expect(requests.map(({ url }) => url)).not.toContain(PRODUCTIONS);

    signInNeeded.value = false;
    await flushPromises();
    expect(requests.map(({ url }) => url)).toContain(PRODUCTIONS);
    expect(wrapper.get("[data-test=production-year]").text()).toBe("Gang Show 2028");
  });
});
