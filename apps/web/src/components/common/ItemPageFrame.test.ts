import { type DepartmentId, departmentIds, type RunningOrderItem } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h } from "vue";
import { createMemoryHistory } from "vue-router";
import { json } from "@/app.fixture.ts";
import { createAppRouter } from "@/router/index.ts";
import { departmentNotesPath, runningOrderPath } from "@/services/production.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { itemRouteOf } from "@/utils/departments.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";
import { placeOf, positionOf } from "@/utils/running-order.ts";
import ItemPageFrame from "./ItemPageFrame.vue";

enableAutoUnmount(afterEach);
beforeEach(useLocalSignIn);
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

// Made-up items, in show order: Opening Number, Pirate Sketch | Finale.
const show = aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")], [anItem("Finale")]);

/** A stand-in API with the running order (none if undefined), or failing to give it. */
function apiHolds(order: typeof show | undefined | "fails") {
  const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url === runningOrderPath()) {
      if (order === "fails") return new Response(null, { status: 500 });
      return order ? json(order) : new Response(null, { status: 404 });
    }
    if (url.endsWith("-notes")) return json({ productionId: "2027", notes: [] });
    return new Response(null, { status: 204 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

/** The page's own data for an item, as a stand-in page shows it under the frame. */
const shown: string[] = [];
const loadsAt = (id: string) => async () => () => {
  shown.push(id);
};

/** The frame for a department's page at an item, with a stand-in page in it. */
async function openFrame(
  department: DepartmentId,
  itemId: string,
  load: (itemId: string) => Promise<() => void> = (id) => loadsAt(id)(),
) {
  const router = createAppRouter(createMemoryHistory());
  await router.push({ name: itemRouteOf(department), params: { itemId } });
  await router.isReady();
  const wrapper = mount(ItemPageFrame, {
    props: { department, load },
    slots: {
      default: ({ item }: { item: RunningOrderItem }) =>
        h("p", { "data-test": "page" }, `${item.title}'s ${department}`),
    },
    global: { plugins: [router] },
    attachTo: document.body,
  });
  await flushPromises();
  return { wrapper, router };
}

beforeEach(() => {
  shown.length = 0;
});

describe("The item page frame", () => {
  it.each([
    ["scenery", "Scenery"],
    ["sfx", "SFX"],
    ["wardrobe", "Wardrobe"],
  ] as const)(
    "titles the %s page with the department and item, with its help and position",
    async (department, name) => {
      apiHolds(show);
      const { wrapper } = await openFrame(department, "opening-number");

      const row = wrapper.get(".page-title-row");
      expect(row.get("h1").text()).toBe(`${name}: Opening Number`);
      expect(row.find("button[aria-label='Help for this item']").exists()).toBe(true);
      const place = placeOf(show, "opening-number");
      expect(wrapper.get("[data-test=position]").text()).toBe(place ? positionOf(place) : "");
      expect(document.title).toContain(`${name}: Opening Number`);
    },
  );

  it("goes back to the Production overview, and steps to the neighbouring items' pages", async () => {
    apiHolds(show);
    const { wrapper } = await openFrame("sfx", "pirate-sketch");

    expect(wrapper.get("a.back-link").text()).toBe("All items");
    expect(wrapper.get("a.back-link").attributes("href")).toBe("/production/overview");
    const steps = wrapper
      .findAll("a[rel]")
      .map((link) => [link.attributes("rel"), link.attributes("href")]);
    expect(steps).toEqual([
      ["prev", "/production/items/opening-number/sfx"],
      ["next", "/production/items/finale/sfx"],
    ]);
  });

  it("has no Previous on the first item, and no Next on the last", async () => {
    apiHolds(show);
    const first = await openFrame("sfx", "opening-number");
    expect(first.wrapper.findAll("a[rel]").map((link) => link.attributes("rel"))).toEqual(["next"]);
    first.wrapper.unmount();

    const last = await openFrame("sfx", "finale");
    expect(last.wrapper.findAll("a[rel]").map((link) => link.attributes("rel"))).toEqual(["prev"]);
  });

  it("heads the notes with the department, and keeps them at the department's own path", async () => {
    const fetch = apiHolds(show);
    const { wrapper } = await openFrame("wardrobe", "opening-number");

    expect(wrapper.get("#notes-heading").text()).toBe("Wardrobe notes");
    expect(fetch.mock.calls.map(([url]) => url)).toContain(departmentNotesPath("wardrobe"));
  });

  it.each(departmentIds)(
    "says how many characters the %s notes have left near the limit",
    async (department) => {
      apiHolds(show);
      const { wrapper } = await openFrame(department, "opening-number");

      await wrapper.get("textarea[name=notes]").setValue("x".repeat(460));

      expect(wrapper.get("[data-test=notes-count]").text()).toBe("40 characters left");
    },
  );

  it.each([
    ["isn't in the running order", show],
    ["has no saved running order", undefined],
  ])("says an item not found when the show %s, with All items still there", async (_, order) => {
    apiHolds(order);
    const { wrapper } = await openFrame("scenery", "no-such-item");

    expect(wrapper.get("h1").text()).toBe("Item not found");
    expect(wrapper.text()).toContain(
      "It isn't in the latest saved running order. Choose an item from All items.",
    );
    expect(wrapper.find("[data-test=page]").exists()).toBe(false);
    expect(wrapper.get("a.back-link").attributes("href")).toBe("/production/overview");
  });

  it.each([
    ["the running order", "fails" as const, (id: string) => loadsAt(id)()],
    ["the page's own data", show, () => Promise.reject(new Error("HTTP 500"))],
  ])("shows one error in place of the page when %s fails to load", async (_, order, load) => {
    apiHolds(order);
    const { wrapper } = await openFrame("sfx", "opening-number", load);

    expect(wrapper.findAll("[role=alert]").map((alert) => alert.text())).toEqual([
      "Couldn't load the item.",
    ]);
    expect(wrapper.find("h1").exists()).toBe(false);
    expect(wrapper.find("[data-test=page]").exists()).toBe(false);
    expect(wrapper.find("#notes-heading").exists()).toBe(false);
    expect(wrapper.get("a.back-link").attributes("href")).toBe("/production/overview");
  });

  it.each([
    ["scenery", [{ event: "scenery", productionId: "2027", itemId: "opening-number" }]],
    ["mic-plot", [{ event: "mic-plot", productionId: "2027", itemId: "opening-number" }]],
    ["casting", [{ event: "item", productionId: "2027", itemId: "opening-number" }]],
    ["props", [{ event: "props", productionId: "2027", itemId: "opening-number" }]],
  ] as const)(
    "records a visit to the %s page for the item found, and none for one not found",
    async (department, expected) => {
      const fetch = apiHolds(show);
      await openFrame(department, "opening-number");
      await openFrame(department, "no-such-item");

      const visits = fetch.mock.calls
        .filter(([url]) => url === "/api/usage")
        .map(([, init]) => JSON.parse(String(init?.body)));
      expect(visits).toEqual(expected);
    },
  );

  it("shows the next item's page, never the last one's, when Next is chosen while it loads", async () => {
    apiHolds(show);
    // Pirate Sketch's data only arrives once Finale's has been shown.
    let finishPirateSketch = () => {};
    const load = (id: string) =>
      id === "pirate-sketch"
        ? new Promise<() => void>((resolve) => {
            finishPirateSketch = () => resolve(() => shown.push(id));
          })
        : loadsAt(id)();
    const { wrapper } = await openFrame("scenery", "opening-number", load);

    await wrapper.get("a[rel=next]").trigger("click");
    await flushPromises();
    await wrapper.get("a[rel=next]").trigger("click");
    await flushPromises();
    finishPirateSketch();
    await flushPromises();

    expect(wrapper.get("h1").text()).toBe("Scenery: Finale");
    expect(wrapper.get("[data-test=page]").text()).toBe("Finale's scenery");
    expect(shown).toEqual(["opening-number", "finale"]);
  });
});
