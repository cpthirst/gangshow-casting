import type { RunningOrder } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import { createAppRouter } from "../router.ts";
import { anItem, aRunningOrder } from "../running-order.fixture.ts";
import { RUNNING_ORDER_PATH } from "../running-order.ts";
import CastingItemsPage from "./CastingItemsPage.vue";

enableAutoUnmount(afterEach);

function savedRunningOrderIs(order: RunningOrder) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(order)));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function apiAnswers(response: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(response));
}

// The page links to other pages, so it needs the app's router.
async function openItemsPage() {
  const wrapper = mount(CastingItemsPage, {
    global: { plugins: [createAppRouter(createMemoryHistory())] },
  });
  await flushPromises();
  return wrapper;
}

const titlesIn = (wrapper: VueWrapper, halfName: string) => {
  const half = wrapper.findAll("section").find((s) => s.find("h2").text() === halfName);
  return half?.findAll("[data-test=title]").map((title) => title.text());
};

const rowFor = (wrapper: VueWrapper, title: string) =>
  wrapper.findAll("[data-test=item]").find((row) => row.get("[data-test=title]").text() === title);

describe("Casting items page", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the items in their halves, in running order", async () => {
    savedRunningOrderIs(
      aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")], [anItem("Campfire Song")]),
    );

    const wrapper = await openItemsPage();

    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
    expect(titlesIn(wrapper, "Second half")).toEqual(["Campfire Song"]);
  });

  it("shows each item's running-order number", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]));

    const wrapper = await openItemsPage();

    expect(rowFor(wrapper, "Opening Number")?.get("[data-test=number]").text()).toBe("1");
    expect(rowFor(wrapper, "Pirate Sketch")?.get("[data-test=number]").text()).toBe("2");
  });

  it("lists items not in the printed programme without a number", async () => {
    savedRunningOrderIs(
      aRunningOrder([
        anItem("Opening Number"),
        anItem("Mystery Act", { printed: false }),
        anItem("Pirate Sketch"),
      ]),
    );

    const wrapper = await openItemsPage();

    const mystery = rowFor(wrapper, "Mystery Act");
    expect(mystery?.get("[data-test=number]").text()).toBe("Not in printed programme");
    expect(rowFor(wrapper, "Pirate Sketch")?.get("[data-test=number]").text()).toBe("2");
  });

  it("has no running-order controls", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]));

    const wrapper = await openItemsPage();

    expect(wrapper.find(".drag-handle").exists()).toBe(false);
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("shows which saved draft the list is based on", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number")], [], 7));

    const wrapper = await openItemsPage();

    expect(wrapper.get("[data-test=version]").text()).toBe("Based on Draft 7");
  });

  it("shows a newly saved order when the page is opened again", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number")], [anItem("Campfire Song")], 7));
    (await openItemsPage()).unmount();

    savedRunningOrderIs(aRunningOrder([anItem("Opening Number"), anItem("Campfire Song")], [], 8));
    const wrapper = await openItemsPage();

    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Campfire Song"]);
    expect(wrapper.get("[data-test=version]").text()).toBe("Based on Draft 8");
  });

  // Unsaved moves live only in the Running order page; the API serves the last saved version.
  it("shows the latest saved running order, not unsaved edits", async () => {
    const fetch = savedRunningOrderIs(
      aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]),
    );

    const wrapper = await openItemsPage();

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(RUNNING_ORDER_PATH);
    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
  });

  it("explains that there's no saved running order, with a link to set one up", async () => {
    apiAnswers(async () => new Response(null, { status: 404 }));

    const wrapper = await openItemsPage();

    expect(wrapper.text()).toContain("There's no saved running order yet.");
    expect(wrapper.get("a[href='/']").text()).toBe("Running order page");
  });

  it("reports a failed load rather than an empty running order", async () => {
    apiAnswers(async () => {
      throw new TypeError("Failed to fetch");
    });

    const wrapper = await openItemsPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the items.");
    expect(wrapper.text()).not.toContain("There's no saved running order yet.");
  });

  it("reports a server error rather than an empty running order", async () => {
    apiAnswers(async () => new Response(null, { status: 500 }));

    const wrapper = await openItemsPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the items.");
    expect(wrapper.text()).not.toContain("There's no saved running order yet.");
  });

  it("reports a running order it can't read rather than an empty one", async () => {
    apiAnswers(async () => new Response(JSON.stringify({ halves: "not a running order" })));

    const wrapper = await openItemsPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the items.");
    expect(wrapper.text()).not.toContain("There's no saved running order yet.");
  });

  it("links each item to its page, named by its number and title", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]));

    const wrapper = await openItemsPage();

    const link = rowFor(wrapper, "Pirate Sketch")?.get("a");
    expect(link?.attributes("href")).toBe("/casting/items/pirate-sketch");
    expect(link?.text().replace(/\s+/g, " ")).toBe("2 Pirate Sketch");
  });
});
