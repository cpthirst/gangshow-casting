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
    const menu = wrapper.get("nav[aria-label=Main]");
    const topLevel = menu.findAll(":scope > ul > li").map((item) => item.text());
    expect(topLevel).toEqual(["Running order", "Cast", expect.stringMatching(/^Casting/)]);
    expect(menu.findAll("a").map((link) => link.text())).toEqual([
      "Running order",
      "Cast",
      "Overview",
      "Items",
    ]);
    expect(menu.text()).not.toContain("Casting grid");
  });

  it("lists Overview and Items as a list inside Casting", async () => {
    const { wrapper } = await openAppAt("/");

    const subList = wrapper.get("nav[aria-label=Main] > ul > li:nth-child(3) > ul");
    const label = document.getElementById(subList.attributes("aria-labelledby") ?? "");
    expect(label?.textContent).toBe("Casting");
    expect(subList.findAll(":scope > li > a").map((link) => link.text())).toEqual([
      "Overview",
      "Items",
    ]);
  });

  it("opens the Running order page at the root URL", async () => {
    const { wrapper } = await openAppAt("/");

    expect(wrapper.get("main h1").text()).toBe("Running order");
    expect(document.title).toBe("Running order · Chester Gang Show casting");
  });

  it("shows the running order itself at the root URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const { wrapper } = await openAppAt("/");

    expect(wrapper.get("main").text()).toContain("No running order yet");
  });

  it("asks before leaving the running order with unsaved changes", async () => {
    const order = {
      productionId: "2027",
      title: "Gang Show 2027",
      version: 6,
      savedAt: "2026-10-04T00:00:00.000Z",
      startTime: "19:15",
      intervalMinutes: 20,
      halves: [
        {
          id: "first-half",
          name: "First half",
          items: ["Curtain Up", "Pirate Panic"].map((title) => ({
            id: `itm_${title.toLowerCase().replaceAll(" ", "-")}`,
            title,
            cast: "",
            stage: ["full"],
            leads: "",
            comments: "",
            minutes: 5,
            printed: true,
          })),
        },
        { id: "second-half", name: "Second half", items: [] },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(order))),
    );
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    const { wrapper, router } = await openAppAt("/");
    await wrapper.get("button[aria-label='Move Curtain Up down']").trigger("click");

    await wrapper.get("nav a[href='/cast']").trigger("click");
    await flushPromises();

    expect(confirm).toHaveBeenCalledWith("Discard unsaved changes?");
    expect(router.currentRoute.value.fullPath).toBe("/");
    expect(wrapper.find("[data-test=unsaved]").exists()).toBe(true);
    expect(wrapper.findAll("main tbody [data-test=title]").map((cell) => cell.text())).toEqual([
      "Pirate Panic",
      "Curtain Up",
    ]);

    confirm.mockReturnValue(true);
    await wrapper.get("nav a[href='/cast']").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/cast");
  });

  it("shows the Overview page with its description and URL when chosen", async () => {
    const { wrapper, router } = await openAppAt("/");

    await wrapper.get("nav a[href='/casting/overview']").trigger("click");
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Overview");
    expect(wrapper.get("main p").text()).toBe(
      "Everyone in the cast, by section, and how much they're cast.",
    );
    expect(router.currentRoute.value.fullPath).toBe("/casting/overview");
    expect(document.title).toBe("Overview · Chester Gang Show casting");
  });

  it("shows the Items page with its description and URL when chosen", async () => {
    const { wrapper, router } = await openAppAt("/");

    await wrapper.get("nav a[href='/casting/items']").trigger("click");
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Items");
    expect(wrapper.get("main p").text()).toBe(
      "The show's items, with how far each one's casting has got.",
    );
    expect(router.currentRoute.value.fullPath).toBe("/casting/items");
  });

  it("goes from the Items page to the Running order page when there's no running order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    const { wrapper, router } = await openAppAt("/casting/items");

    await wrapper.get("main a[href='/']").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/");
    expect(wrapper.get("main h1").text()).toBe("Running order");
  });

  it("loads a casting sub-page directly from its URL", async () => {
    const { wrapper } = await openAppAt("/casting/items");

    expect(wrapper.get("main h1").text()).toBe("Items");
  });

  it("opens Overview from the casting path on its own", async () => {
    const { wrapper, router } = await openAppAt("/casting");

    expect(wrapper.get("main h1").text()).toBe("Overview");
    expect(router.currentRoute.value.fullPath).toBe("/casting/overview");
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

  it("sends the old Casting grid URL to Overview", async () => {
    const { wrapper, router } = await openAppAt("/casting-grid");

    expect(wrapper.get("main h1").text()).toBe("Overview");
    expect(router.currentRoute.value.fullPath).toBe("/casting/overview");
  });

  it("goes back past the old Casting grid URL to the page before it", async () => {
    const { wrapper, router } = await openAppAt("/cast");
    await router.push("/casting-grid");
    await flushPromises();
    expect(wrapper.get("main h1").text()).toBe("Overview");

    const navigated = nextNavigation(router);
    router.back();
    await navigated;
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Cast");
  });

  it("returns from Items to Overview on back", async () => {
    const { wrapper, router } = await openAppAt("/casting/overview");
    await router.push("/casting/items");

    const navigated = nextNavigation(router);
    router.back();
    await navigated;
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Overview");
  });

  it("marks only the current casting sub-page in the menu", async () => {
    const { wrapper } = await openAppAt("/casting/items");

    const current = wrapper.findAll("nav a[aria-current=page]");
    expect(current.map((link) => link.text())).toEqual(["Items"]);
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

let screenListeners: ((event: { matches: boolean }) => void)[] = [];

function screenIs(size: "phone" | "laptop") {
  screenListeners = [];
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: size === "phone",
    media: query,
    addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) =>
      screenListeners.push(listener),
    removeEventListener: () => {},
  }));
}

function resizeTo(size: "phone" | "laptop") {
  for (const listener of screenListeners) listener({ matches: size === "phone" });
  return flushPromises();
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

  it("closes the menu after choosing a casting sub-page", async () => {
    const { wrapper } = await openAppAt("/");
    await menuButton(wrapper).trigger("click");

    await wrapper.get("#main-menu a[href='/casting/items']").trigger("click");
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Items");
    expect(menuIsVisible(wrapper)).toBe(false);
  });

  it("keeps the menu open when the Casting label is tapped", async () => {
    const { wrapper } = await openAppAt("/");
    await menuButton(wrapper).trigger("click");

    await wrapper.get("#main-menu .menu-group").trigger("click");

    expect(menuIsVisible(wrapper)).toBe(true);
  });

  it("moves focus to the page content after choosing a page", async () => {
    const { wrapper } = await openAppAt("/");
    await menuButton(wrapper).trigger("click");

    await wrapper.get("#main-menu a[href='/cast']").trigger("click");
    await flushPromises();

    expect(document.activeElement).toBe(wrapper.get("main").element);
  });

  it("closes the menu on Escape and returns focus to the Menu button", async () => {
    const { wrapper } = await openAppAt("/");
    await menuButton(wrapper).trigger("click");

    await wrapper.get("#main-menu a").trigger("keydown", { key: "Escape" });

    expect(menuIsVisible(wrapper)).toBe(false);
    expect(document.activeElement).toBe(menuButton(wrapper).element);
  });

  it("closes the menu on Escape while the Menu button has focus", async () => {
    const { wrapper } = await openAppAt("/");
    await menuButton(wrapper).trigger("click");

    await menuButton(wrapper).trigger("keydown", { key: "Escape" });

    expect(menuIsVisible(wrapper)).toBe(false);
    expect(menuButton(wrapper).attributes("aria-expanded")).toBe("false");
  });

  it("switches to the sidebar when the screen widens, closing the phone menu", async () => {
    const { wrapper } = await openAppAt("/");
    await menuButton(wrapper).trigger("click");

    await resizeTo("laptop");
    expect(wrapper.find("button[aria-controls=main-menu]").exists()).toBe(false);
    expect(menuIsVisible(wrapper)).toBe(true);

    await resizeTo("phone");
    expect(menuIsVisible(wrapper)).toBe(false);
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
