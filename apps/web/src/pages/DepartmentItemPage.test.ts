import type { RunningOrder } from "@app/shared";
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

enableAutoUnmount(afterEach);
// As on pnpm dev: everyone acts as an admin, unless a test signs someone in.
beforeEach(useLocalSignIn);
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  useLocalSignIn();
});

// Made-up items, in show order: Opening Number, Pirate Sketch | Finale.
const show = aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")], [anItem("Finale")]);

const json = (body: unknown) => new Response(JSON.stringify(body));

/** A stand-in API holding one saved running order (none if undefined), and no props or
 *  casting. */
function savedShowIs(order: RunningOrder | undefined) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === RUNNING_ORDER_PATH) {
        return order ? json(order) : new Response(null, { status: 404 });
      }
      if (url === PROPS_PATH) return json({ productionId: "2027", props: [] });
      if (url === PROPS_NOTES_PATH) return json({ productionId: "2027", notes: [] });
      if (url === ROLES_PATH) return json({ productionId: "2027", roles: [] });
      if (url === CAST_PATH) return json({ productionId: "2027", members: [] });
      if (url === "/api/usage") return new Response(null, { status: 204 });
      return json({ status: "ok", version: "dev" });
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

const stepLinks = (wrapper: VueWrapper) =>
  wrapper.findAll("main nav[aria-label='Item navigation'] a[rel]").map((link) => ({
    rel: link.attributes("rel"),
    href: link.attributes("href"),
  }));

async function choose(wrapper: VueWrapper, department: string, title: string) {
  const row = wrapper
    .findAll("[data-test=item]")
    .find((r) => r.get("[data-test=title]").text() === title);
  const button = row
    ?.findAll(".icon-button")
    .find((b) => b.attributes("data-tooltip") === department);
  await button?.trigger("click");
  await flushPromises();
}

describe("A department's item page", () => {
  it("opens the mic plot page from the Overview, with the item's name and position, coming soon", async () => {
    savedShowIs(show);
    const { wrapper, router } = await openAppAt("/production/overview");

    await choose(wrapper, "Mic plot", "Opening Number");

    expect(router.currentRoute.value.fullPath).toBe("/production/items/opening-number/mic-plot");
    expect(wrapper.get("main h1").text()).toBe("Mic plot: Opening Number");
    expect(wrapper.get("[data-test=position]").text()).toBe("Item 1 · First half");
    expect(wrapper.get("main").text()).toContain("Coming soon");
  });

  it.each([
    ["Scenery", "scenery"],
    ["SFX", "sfx"],
    ["Wardrobe", "wardrobe"],
  ])("opens the %s page for the item, titled for both, coming soon", async (department, path) => {
    savedShowIs(show);
    const { wrapper, router } = await openAppAt("/production/overview");

    await choose(wrapper, department, "Opening Number");

    expect(router.currentRoute.value.fullPath).toBe(`/production/items/opening-number/${path}`);
    expect(wrapper.get("main h1").text()).toBe(`${department}: Opening Number`);
    expect(document.title).toBe(`${department}: Opening Number · iCUE`);
    expect(wrapper.get("main").text()).toContain("Coming soon");
  });

  it("goes back to the Overview, and steps to the previous and next items' SFX pages", async () => {
    savedShowIs(show);
    const { wrapper, router } = await openAppAt("/production/items/pirate-sketch/sfx");

    expect(stepLinks(wrapper)).toEqual([
      { rel: "prev", href: "/production/items/opening-number/sfx" },
      { rel: "next", href: "/production/items/finale/sfx" },
    ]);

    await wrapper.get("main a[rel=next]").trigger("click");
    await flushPromises();
    expect(wrapper.get("main h1").text()).toBe("SFX: Finale");

    await wrapper.get("main a.back-link").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/production/overview");
  });

  it("has no Previous on the first item, and no Next on the last", async () => {
    savedShowIs(show);
    const first = await openAppAt("/production/items/opening-number/sfx");
    expect(stepLinks(first.wrapper).map((link) => link.rel)).toEqual(["next"]);
    first.wrapper.unmount();

    const { wrapper } = await openAppAt("/production/items/finale/sfx");
    expect(stepLinks(wrapper).map((link) => link.rel)).toEqual(["prev"]);
  });

  it("marks the Production overview as the current page in the menu", async () => {
    savedShowIs(show);
    const { wrapper } = await openAppAt("/production/items/finale/scenery");

    const current = wrapper.findAll("nav a[aria-current=page]");
    expect(current.map((link) => link.attributes("href"))).toEqual(["/production/overview"]);
  });

  it("says an item that isn't in the running order wasn't found, with a link back to the Overview", async () => {
    savedShowIs(show);
    const { wrapper, router } = await openAppAt("/production/items/no-such-item/wardrobe");

    expect(wrapper.get("main h1").text()).toBe("Item not found");
    expect(document.title).toBe("Item not found · iCUE");
    expect(wrapper.get("main").text()).not.toContain("Coming soon");
    await wrapper.get("main a.back-link").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/production/overview");
  });

  it("says the item wasn't found when there's no saved running order", async () => {
    savedShowIs(undefined);
    const { wrapper } = await openAppAt("/production/items/finale/wardrobe");

    expect(wrapper.get("main h1").text()).toBe("Item not found");
  });

  it("reports a failed load rather than not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const { wrapper } = await openAppAt("/production/items/finale/wardrobe");

    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the item.");
    expect(wrapper.get("main").text()).not.toContain("Item not found");
  });

  it("opens every department's page for someone with no permissions", async () => {
    await signInAs([], "jo");
    savedShowIs(show);

    for (const [department, heading] of [
      ["Scenery", "Scenery: Pirate Sketch"],
      ["Props", "Props: Pirate Sketch"],
      ["SFX", "SFX: Pirate Sketch"],
      ["Mic plot", "Mic plot: Pirate Sketch"],
      ["Wardrobe", "Wardrobe: Pirate Sketch"],
    ] as const) {
      const { wrapper } = await openAppAt("/production/overview");
      await choose(wrapper, department, "Pirate Sketch");
      expect(wrapper.get("main h1").text()).toBe(heading);
      wrapper.unmount();
    }
  });
});
