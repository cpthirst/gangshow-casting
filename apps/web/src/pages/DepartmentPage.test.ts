import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "@/App.vue";
import { createAppRouter } from "@/router/index.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { PROPS_PATH } from "@/utils/props.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";
import { RUNNING_ORDER_PATH } from "@/utils/running-order.ts";

enableAutoUnmount(afterEach);

async function openAppAt(path: string) {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return { wrapper, router };
}

const switchButtons = (wrapper: VueWrapper) => wrapper.findAll("main .view-switch button");
const labels = (wrapper: VueWrapper) => switchButtons(wrapper).map((button) => button.text());
const chosen = (wrapper: VueWrapper) =>
  switchButtons(wrapper)
    .filter((button) => button.attributes("aria-pressed") === "true")
    .map((button) => button.text());
async function choose(wrapper: VueWrapper, label: string) {
  await switchButtons(wrapper)
    .find((button) => button.text() === label)
    ?.trigger("click");
  await flushPromises();
}
const shownView = (wrapper: VueWrapper) => wrapper.get("[data-test=department-view]");

const posted = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([url, init]) => url === "/api/usage" && init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init?.body)));

beforeEach(() => {
  useLocalSignIn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url === "/api/usage"
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify({ status: "ok", version: "dev" })),
    ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  useLocalSignIn();
  document.body.innerHTML = "";
});

describe("Stage page", () => {
  it("opens on Scenery, with a switch of Scenery then Props", async () => {
    const { wrapper } = await openAppAt("/production/stage");

    expect(wrapper.get("main h1").text()).toBe("Stage");
    expect(labels(wrapper)).toEqual(["Scenery", "Props"]);
    expect(chosen(wrapper)).toEqual(["Scenery"]);
    expect(shownView(wrapper).attributes("aria-label")).toBe("Scenery");
  });

  it("shows the Props view once Props is chosen, and keeps it in the address", async () => {
    const { wrapper, router } = await openAppAt("/production/stage");

    await choose(wrapper, "Props");

    expect(chosen(wrapper)).toEqual(["Props"]);
    expect(shownView(wrapper).attributes("aria-label")).toBe("Props");
    expect(router.currentRoute.value.fullPath).toBe("/production/stage?view=props");
  });

  it("goes back to Scenery, at the page's own address, once Scenery is chosen again", async () => {
    const { wrapper, router } = await openAppAt("/production/stage?view=props");

    await choose(wrapper, "Scenery");

    expect(chosen(wrapper)).toEqual(["Scenery"]);
    expect(router.currentRoute.value.fullPath).toBe("/production/stage");
  });

  it("opens on Scenery for an address naming a view it doesn't have", async () => {
    const { wrapper } = await openAppAt("/production/stage?view=sfx");

    expect(chosen(wrapper)).toEqual(["Scenery"]);
  });

  it("has a help button in its title row", async () => {
    const { wrapper } = await openAppAt("/production/stage");

    expect(wrapper.find(".page-title-row button[aria-label='Help for Stage']").exists()).toBe(true);
  });
});

describe("Tech page", () => {
  it("opens on Mic plot, with a switch of Mic plot and SFX", async () => {
    const { wrapper } = await openAppAt("/production/tech");

    expect(wrapper.get("main h1").text()).toBe("Tech");
    expect(labels(wrapper)).toEqual(["Mic plot", "SFX"]);
    expect(chosen(wrapper)).toEqual(["Mic plot"]);
  });
});

describe("Views not built yet", () => {
  it.each([
    ["/production/stage", "Scenery"],
    ["/production/tech", "Mic plot"],
    ["/production/tech", "SFX"],
  ])("on %s, %s says Coming soon", async (path, view) => {
    const { wrapper } = await openAppAt(path);

    await choose(wrapper, view);

    expect(shownView(wrapper).attributes("aria-label")).toBe(view);
    expect(shownView(wrapper).get(".coming-soon").text()).toBe("Coming soon");
  });
});

describe("Stage's Props view", () => {
  it("lists the show's items in place of Coming soon", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (input === RUNNING_ORDER_PATH) {
        return new Response(JSON.stringify(aRunningOrder([anItem("Pirate Sketch")])));
      }
      if (input === PROPS_PATH)
        return new Response(JSON.stringify({ productionId: "2027", props: [] }));
      return new Response(null, { status: 204 });
    });

    const { wrapper } = await openAppAt("/production/stage?view=props");

    expect(shownView(wrapper).find(".coming-soon").exists()).toBe(false);
    expect(shownView(wrapper).get("[data-test=title]").text()).toBe("Pirate Sketch");
  });
});

describe("Stage's Props view, by permission", () => {
  beforeEach(() => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (input === RUNNING_ORDER_PATH) {
        return new Response(JSON.stringify(aRunningOrder([anItem("Pirate Sketch")])));
      }
      if (input === PROPS_PATH)
        return new Response(JSON.stringify({ productionId: "2027", props: [] }));
      return new Response(null, { status: 204 });
    });
  });

  it("tells someone without Stage, before the view's description, that they can only view the props", async () => {
    await signInAs(["casting"], "sam");

    const { wrapper } = await openAppAt("/production/stage?view=props");

    const notice = shownView(wrapper).get("[data-test=read-only]");
    expect(notice.text()).toBe("You can view the props, but not change them.");
    expect(notice.element.nextElementSibling?.textContent).toBe(
      "The show's items, with how many props each one needs.",
    );
  });

  it("doesn't say the props can only be viewed to someone with Stage", async () => {
    await signInAs(["stage"], "pat");

    const { wrapper } = await openAppAt("/production/stage?view=props");

    expect(shownView(wrapper).find("[data-test=read-only]").exists()).toBe(false);
  });
});

describe("Costume page", () => {
  it("says Coming soon, with no view switch", async () => {
    const { wrapper } = await openAppAt("/production/costume");

    expect(wrapper.get("main h1").text()).toBe("Costume");
    expect(wrapper.get("main .coming-soon").text()).toBe("Coming soon");
    expect(wrapper.find("main .view-switch").exists()).toBe(false);
  });
});

describe("Department pages for someone with no permissions", () => {
  it.each([
    ["/production/stage", "Stage", ["Scenery", "Props"]],
    ["/production/tech", "Tech", ["Mic plot", "SFX"]],
    ["/production/costume", "Costume", []],
  ])("opens %s and every view on it", async (path, title, views) => {
    await signInAs([], "jo");
    const { wrapper } = await openAppAt(path);

    expect(wrapper.get("main h1").text()).toBe(title);
    for (const view of views) {
      await choose(wrapper, view);
      expect(shownView(wrapper).attributes("aria-label")).toBe(view);
    }
  });
});

describe("Old Production addresses", () => {
  it.each([
    ["/production/scenery", "stage", "Scenery"],
    ["/production/props", "stage", "Props"],
    ["/production/mic-plot", "tech", "Mic plot"],
    ["/production/sfx", "tech", "SFX"],
  ])("opens %s as the %s page on its %s view", async (path, page, view) => {
    const { wrapper, router } = await openAppAt(path);

    expect(router.currentRoute.value.name).toBe(page);
    expect(chosen(wrapper)).toEqual([view]);
    expect(shownView(wrapper).attributes("aria-label")).toBe(view);
  });
});

describe("The view switch for keyboard and screen reader users", () => {
  it("is a labelled group of buttons, each reachable, saying which is chosen", async () => {
    const { wrapper } = await openAppAt("/production/stage");

    const group = wrapper.get("main .view-switch");
    expect(group.attributes("role")).toBe("group");
    expect(group.attributes("aria-label")).toBe("Choose which list to see");
    for (const button of switchButtons(wrapper)) {
      expect(button.element.tagName).toBe("BUTTON");
      expect(button.attributes("type")).toBe("button");
      expect(button.attributes("tabindex")).toBeUndefined();
      expect(button.attributes("disabled")).toBeUndefined();
    }

    await switchButtons(wrapper)[1]?.trigger("click");
    await flushPromises();
    expect(switchButtons(wrapper).map((b) => b.attributes("aria-pressed"))).toEqual([
      "false",
      "true",
    ]);
  });
});

describe("Recording the department pages' use", () => {
  it("records opening Stage once, and each switch as a use of that view", async () => {
    const { wrapper } = await openAppAt("/production/stage");

    await choose(wrapper, "Props");
    await choose(wrapper, "Scenery");

    expect(posted().filter((body) => body.event !== "session")).toEqual([
      { event: "page", page: "stage" },
      { event: "view", view: "props" },
      { event: "view", view: "scenery" },
    ]);
  });

  it("records no view on opening, nor on choosing the view already shown", async () => {
    const { wrapper } = await openAppAt("/production/tech?view=sfx");

    await choose(wrapper, "SFX");

    expect(posted().filter((body) => body.event === "view")).toEqual([]);
  });
});
