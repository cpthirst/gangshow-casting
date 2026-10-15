import type { RunningOrder } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "../App.vue";
import { createAppRouter } from "../router.ts";
import { anItem, aRunningOrder } from "../running-order.fixture.ts";

enableAutoUnmount(afterEach);

const show = aRunningOrder(
  [anItem("Opening Number"), anItem("Pirate Sketch")],
  [anItem("Campfire Song"), anItem("Mystery Act", { printed: false })],
);

function savedRunningOrderIs(order: RunningOrder) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(order))),
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

describe("Casting item page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("opens from the Items list, showing the item's name and position", async () => {
    savedRunningOrderIs(show);
    const { wrapper, router } = await openAppAt("/casting/items");

    await wrapper.get("main a[href='/casting/items/pirate-sketch']").trigger("click");
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Pirate Sketch");
    expect(wrapper.get("[data-test=position]").text()).toBe("Item 2 · First half");
    expect(router.currentRoute.value.fullPath).toBe("/casting/items/pirate-sketch");
    expect(document.title).toBe("Pirate Sketch · Chester Gang Show casting");
  });

  it("shows only the half for an item not in the printed programme", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/mystery-act");

    expect(wrapper.get("[data-test=position]").text()).toBe(
      "Second half · Not in printed programme",
    );
  });

  it("says when no roles have been added", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(wrapper.get("main").text()).toContain("No roles have been added yet.");
  });

  it("names the item in the browser tab", async () => {
    savedRunningOrderIs(show);
    await openAppAt("/casting/items/pirate-sketch");

    expect(document.title).toBe("Pirate Sketch · Chester Gang Show casting");
  });

  it("loads directly from its URL", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/campfire-song");

    expect(wrapper.get("main h1").text()).toBe("Campfire Song");
    expect(wrapper.get("[data-test=position]").text()).toBe("Item 1 · Second half");
  });

  it("marks Items as the current page in the menu", async () => {
    savedRunningOrderIs(show);
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    const current = wrapper.findAll("nav a[aria-current=page]");
    expect(current.map((link) => link.text())).toEqual(["Items"]);
  });

  it("goes back to the Items list from All items", async () => {
    savedRunningOrderIs(show);
    const { wrapper, router } = await openAppAt("/casting/items/pirate-sketch");

    const allItems = wrapper.findAll("main a").find((link) => link.text() === "All items");
    await allItems?.trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/casting/items");
    expect(wrapper.get("main h1").text()).toBe("Items");
  });
});
