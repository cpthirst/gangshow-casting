import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, type Router } from "vue-router";
import App from "./App.vue";
import { createAppRouter } from "./router.ts";

async function openAppAt(path: string) {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return { wrapper, router };
}

function nextNavigation(router: Router) {
  return new Promise<void>((resolve) => {
    const stop = router.afterEach(() => {
      stop();
      resolve();
    });
  });
}

const respondWith = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("App shell", () => {
  beforeEach(() => vi.stubGlobal("fetch", respondWith(200, { status: "ok", version: "1.2.3" })));
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("shows the wordmark and the menu items in order", async () => {
    const { wrapper } = await openAppAt("/");

    const wordmark = wrapper.get("[data-test=wordmark]");
    expect(wordmark.findAll("span").map((line) => line.text())).toEqual([
      "Chester Gang Show",
      "Casting",
    ]);
    const menu = wrapper.get("nav[aria-label=Main]").findAll("a");
    expect(menu.map((link) => link.text())).toEqual(["Running order", "Cast", "Casting grid"]);
  });

  it("opens the Running order page at the root URL", async () => {
    const { wrapper } = await openAppAt("/");

    expect(wrapper.get("main h1").text()).toBe("Running order");
    expect(document.title).toBe("Running order · Chester Gang Show casting");
  });

  it("shows a page with its description and URL when chosen from the menu", async () => {
    const { wrapper, router } = await openAppAt("/");

    await wrapper.get("nav a[href='/cast']").trigger("click");
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Cast");
    expect(wrapper.get("main p").text()).toBe("The Scouts and Explorers in this production.");
    expect(router.currentRoute.value.fullPath).toBe("/cast");
    expect(document.title).toBe("Cast · Chester Gang Show casting");
  });

  it("loads a page directly from its URL", async () => {
    const { wrapper } = await openAppAt("/casting-grid");

    expect(wrapper.get("main h1").text()).toBe("Casting grid");
  });

  it("returns to the previous page on back", async () => {
    const { wrapper, router } = await openAppAt("/");
    await router.push("/cast");

    const navigated = nextNavigation(router);
    router.back();
    await navigated;
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Running order");
  });

  it("marks only the current page in the menu", async () => {
    const { wrapper } = await openAppAt("/cast");

    const current = wrapper.findAll("nav a[aria-current=page]");
    expect(current.map((link) => link.text())).toEqual(["Cast"]);
  });

  it("shows page not found with a link back for an unknown URL", async () => {
    const { wrapper, router } = await openAppAt("/no-such-page");

    expect(wrapper.get("main h1").text()).toBe("Page not found");
    await wrapper.get("main a").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/");
    expect(wrapper.get("main h1").text()).toBe("Running order");
  });

  it("offers a skip link first that moves focus to the page content", async () => {
    const { wrapper } = await openAppAt("/");

    const firstFocusable = document.body.querySelector("a[href], button");
    expect(firstFocusable?.textContent?.trim()).toBe("Skip to main content");

    await wrapper.get("[data-test=skip-link]").trigger("click");
    expect(document.activeElement).toBe(wrapper.get("main").element);
  });

  it("keeps the API status visible in the shell", async () => {
    const { wrapper } = await openAppAt("/cast");

    expect(wrapper.text()).toContain("API: ok (1.2.3)");
  });

  it("still renders the shell when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { wrapper } = await openAppAt("/");

    expect(wrapper.get("main h1").text()).toBe("Running order");
    expect(wrapper.text()).toContain("API: unavailable");
  });
});

function screenIs(size: "phone" | "laptop") {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: size === "phone",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe("App shell on a phone", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", respondWith(200, { status: "ok", version: "1.2.3" }));
    screenIs("phone");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  const menuButton = (wrapper: Awaited<ReturnType<typeof openAppAt>>["wrapper"]) =>
    wrapper.get("button[aria-controls=main-menu]");
  const menuIsVisible = (wrapper: Awaited<ReturnType<typeof openAppAt>>["wrapper"]) =>
    wrapper.get("#main-menu").isVisible();

  it("starts with the menu closed behind a Menu button", async () => {
    const { wrapper } = await openAppAt("/");

    expect(menuButton(wrapper).text()).toBe("Menu");
    expect(menuButton(wrapper).attributes("aria-expanded")).toBe("false");
    expect(menuIsVisible(wrapper)).toBe(false);
  });

  it("opens the menu from the Menu button", async () => {
    const { wrapper } = await openAppAt("/");

    await menuButton(wrapper).trigger("click");

    expect(menuIsVisible(wrapper)).toBe(true);
    expect(menuButton(wrapper).attributes("aria-expanded")).toBe("true");
  });

  it("closes the menu after choosing a page", async () => {
    const { wrapper } = await openAppAt("/");
    await menuButton(wrapper).trigger("click");

    await wrapper.get("#main-menu a[href='/cast']").trigger("click");
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Cast");
    expect(menuIsVisible(wrapper)).toBe(false);
    expect(menuButton(wrapper).attributes("aria-expanded")).toBe("false");
  });

  it("closes the menu on Escape and returns focus to the Menu button", async () => {
    const { wrapper } = await openAppAt("/");
    await menuButton(wrapper).trigger("click");

    await wrapper.get("#main-menu a").trigger("keydown", { key: "Escape" });

    expect(menuIsVisible(wrapper)).toBe(false);
    expect(document.activeElement).toBe(menuButton(wrapper).element);
  });
});

describe("App shell on a laptop", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", respondWith(200, { status: "ok", version: "1.2.3" }));
    screenIs("laptop");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("keeps the menu visible with no Menu button", async () => {
    const { wrapper } = await openAppAt("/");

    expect(wrapper.find("button[aria-controls=main-menu]").exists()).toBe(false);
    expect(wrapper.get("#main-menu").isVisible()).toBe(true);
  });
});
