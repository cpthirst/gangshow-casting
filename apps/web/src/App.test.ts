import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, type Router } from "vue-router";
import App from "./App.vue";
import { createAppRouter } from "./router.ts";
import { signInAs } from "./sign-in.fixture.ts";
import {
  type SignInManager,
  signInUnavailable,
  useHostedSignIn,
  useLocalSignIn,
} from "./sign-in.ts";

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

// The app-wide sign-in state outlives each mount, so every test starts as pnpm dev does.
beforeEach(useLocalSignIn);

describe("App shell", () => {
  beforeEach(() => vi.stubGlobal("fetch", respondWith(200, { status: "ok", version: "1.2.3" })));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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
    expect(topLevel).toEqual([
      "Running order",
      "Cast",
      expect.stringMatching(/^Casting/),
      "Accounts",
    ]);
    expect(menu.findAll("a").map((link) => link.text())).toEqual([
      "Running order",
      "Cast",
      "Overview",
      "Items",
      "Accounts",
    ]);
    expect(menu.text()).not.toContain("Casting grid");
  });

  it("leaves Accounts out of the menu for a signed-in team member who isn't an admin", async () => {
    await signInAs([]);

    const { wrapper } = await openAppAt("/");

    const links = wrapper.get("nav[aria-label=Main]").findAll("a");
    expect(links.map((link) => link.text())).not.toContain("Accounts");
  });

  it("shows Accounts in the menu to a signed-in admin", async () => {
    await signInAs(["admin"]);

    const { wrapper } = await openAppAt("/");

    expect(wrapper.get("nav[aria-label=Main] a[href='/accounts']").text()).toBe("Accounts");
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

  it("labels every page as demo data when serving the demo show", async () => {
    vi.stubEnv("VITE_DEMO", "true");

    for (const path of ["/", "/cast", "/casting/items", "/casting/overview"]) {
      const { wrapper } = await openAppAt(path);
      expect(wrapper.get("[data-test=demo-label]").text()).toContain("Demo data");
      wrapper.unmount();
    }
  });

  it("has no demo label on the real app", async () => {
    const { wrapper } = await openAppAt("/");

    expect(wrapper.find("[data-test=demo-label]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Demo data");
  });

  it("still renders the shell when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { wrapper } = await openAppAt("/");

    expect(wrapper.get("main h1").text()).toBe("Running order");
    expect(wrapper.text()).toContain("API: unavailable");
  });

  describe("when no one is signed in", () => {
    const castMember = { id: 1, firstName: "Ada", lastName: "Testperson" };
    // The API refuses everything, but a page must show nothing even if one answer slipped through.
    // The Cast page asks only for the cast, so there the refusal comes from the shell's API status.
    const refuseExceptCast = vi.fn(async (url: string) =>
      url.endsWith("/cast")
        ? new Response(JSON.stringify([castMember]), { status: 200 })
        : new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 }),
    );
    beforeEach(() => vi.stubGlobal("fetch", refuseExceptCast));

    it.each(["/", "/cast", "/casting/overview", "/casting/items", "/casting/items/1"])(
      "shows no data on %s and says to sign in",
      async (path) => {
        const { wrapper } = await openAppAt(path);

        const main = wrapper.get("main");
        expect(main.get("h1").text()).toBe("You need to sign in");
        expect(main.text()).not.toContain("Testperson");
      },
    );

    it("announces why the page is empty, and says so in the tab and the API status", async () => {
      const { wrapper } = await openAppAt("/cast");

      expect(wrapper.get("main [role=alert]").text()).toContain("Sign in to see it");
      expect(document.title).toBe("Sign in · Chester Gang Show casting");
      expect(wrapper.get(".sidebar-footer").text()).toBe("API: sign in needed");
    });

    it("keeps the tab saying sign in after moving to another page", async () => {
      const { router } = await openAppAt("/cast");

      await router.push("/casting/overview");
      await flushPromises();

      expect(document.title).toBe("Sign in · Chester Gang Show casting");
    });
  });

  describe("signing in on the hosted app", () => {
    const config = {
      clientId: "made-up-client",
      issuer: "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_madeup",
      loginUrl: "https://made-up.auth.eu-west-2.amazoncognito.com",
      appUrl: "https://d111111abcdef8.cloudfront.net/",
    };
    // Signed in, with the hour-long token good for a while yet.
    const sam = { accessToken: "sams-token", expiresAt: Date.now() + 3_600_000, groups: [] };
    const managerWith = (stored: typeof sam | null) =>
      ({
        storedUser: vi.fn(async () => stored),
        refresh: vi.fn(async () => sam),
        finishSignIn: vi.fn(async () => sam),
        startSignIn: vi.fn(async () => {}),
        revoke: vi.fn(async () => {}),
        forget: vi.fn(async () => {}),
      }) satisfies SignInManager;
    const browserAt = (path: string) => ({ path, search: "", replacePath: vi.fn(), goTo: vi.fn() });

    it("offers to sign in when no one is, and starts from the page asked for", async () => {
      const manager = managerWith(null);
      await useHostedSignIn(config, manager, browserAt("/cast"));
      const { wrapper } = await openAppAt("/cast");

      expect(wrapper.find("[data-test=sign-out]").exists()).toBe(false);
      await wrapper.get("main button[data-test=sign-in]").trigger("click");

      expect(manager.startSignIn).toHaveBeenCalledWith("/cast");
    });

    it("shows the page once signed in, with a way to sign out", async () => {
      const manager = managerWith(sam);
      const browser = browserAt("/cast");
      await useHostedSignIn(config, manager, browser);
      const { wrapper } = await openAppAt("/cast");

      expect(wrapper.get("main h1").text()).toBe("Cast");
      await wrapper.get("[data-test=sign-out]").trigger("click");
      await flushPromises();

      expect(manager.forget).toHaveBeenCalled();
      expect(browser.goTo).toHaveBeenCalledWith(expect.stringContaining("/logout?"));
    });

    // The page's own leave question, such as "Discard unsaved changes?", decides.
    it("asks the open page before signing out, and stays if it says to", async () => {
      const manager = managerWith(sam);
      await useHostedSignIn(config, manager, browserAt("/"));
      const { wrapper, router } = await openAppAt("/");
      const keepChanges = router.beforeEach(() => false);

      await wrapper.get("[data-test=sign-out]").trigger("click");
      await flushPromises();
      expect(manager.forget).not.toHaveBeenCalled();
      expect(router.currentRoute.value.path).toBe("/");

      keepChanges();
      await wrapper.get("[data-test=sign-out]").trigger("click");
      await flushPromises();
      expect(manager.forget).toHaveBeenCalled();
    });

    it("says when sign-in couldn't be set up, offering no button that can't work", async () => {
      signInUnavailable();
      const { wrapper } = await openAppAt("/cast");

      expect(wrapper.get("main h1").text()).toBe("You need to sign in");
      expect(wrapper.get("main [role=alert]").text()).toBe(
        "Couldn't set up sign-in. Reload the page to try again.",
      );
      expect(wrapper.find("[data-test=sign-in]").exists()).toBe(false);
    });

    it("has no sign-in or sign-out locally", async () => {
      const { wrapper } = await openAppAt("/cast");

      expect(wrapper.get("main h1").text()).toBe("Cast");
      expect(wrapper.find("[data-test=sign-out]").exists()).toBe(false);
    });
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
