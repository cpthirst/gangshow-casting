import { AddPropRequest, type Prop, type RunningOrder } from "@app/shared";
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
// As on pnpm dev: everyone acts as an admin, unless a test signs someone in.
beforeEach(useLocalSignIn);
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  useLocalSignIn();
});

// Made-up items, in show order: Opening Number, Pirate Sketch | Campfire Song, Finale.
const show = aRunningOrder(
  [anItem("Opening Number"), anItem("Pirate Sketch")],
  [anItem("Campfire Song"), anItem("Finale")],
);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const aProp = (id: number, itemId: string, name: string): Prop => ({ id, itemId, name });

/** A stand-in API holding one saved running order and the props added so far. Returns the
 *  live props, so a test can check what was saved. */
function savedShowIs(order: RunningOrder | undefined, props: Prop[] = []) {
  const stored = [...props];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === RUNNING_ORDER_PATH) {
        return order ? json(order) : new Response(null, { status: 404 });
      }
      if (url === PROPS_PATH) return json({ productionId: "2027", props: stored });
      const addTo = /\/items\/([^/]+)\/props$/.exec(url)?.[1];
      if (addTo && init?.method === "POST") {
        const details = AddPropRequest.parse(JSON.parse(String(init.body)));
        const prop = { ...details, id: stored.length + 1, itemId: addTo };
        stored.push(prop);
        return json(prop, 201);
      }
      return new Response(null, { status: 204 });
    }),
  );
  return stored;
}

/** Makes every add fail, as when the API can't be reached. */
function addingFails() {
  const fetch = vi.mocked(globalThis.fetch);
  const answer = fetch.getMockImplementation();
  fetch.mockImplementation(async (url, init) =>
    init?.method === "POST"
      ? new Response(null, { status: 500 })
      : (answer?.(url, init) ?? json({})),
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

const PIRATE_PROPS = "/production/stage/props/pirate-sketch";

const stepLinks = (wrapper: VueWrapper) =>
  wrapper.findAll("main nav[aria-label='Item navigation'] a[rel]").map((link) => ({
    rel: link.attributes("rel"),
    text: link.text().replace(/\s+/g, " "),
    href: link.attributes("href"),
  }));

const propsShown = (wrapper: VueWrapper) =>
  wrapper.findAll("[data-test=prop]").map((card) => card.get("[data-test=prop-name]").text());

async function addProp(wrapper: VueWrapper, name: string) {
  await wrapper.get("[data-test=add-prop]").trigger("click");
  await wrapper.get("input[name=name]").setValue(name);
  await wrapper.get("form[aria-label='Add prop']").trigger("submit");
  await flushPromises();
}

/** The error shown next to a field: the one its aria-describedby points at. */
const errorFor = (wrapper: VueWrapper, field: string) => {
  const id = wrapper.get(`[name=${field}]`).attributes("aria-describedby");
  return id ? document.getElementById(id)?.textContent?.trim() : undefined;
};

describe("An item's props page", () => {
  it("opens from the Props page, showing the item's name, position and a tab named for it", async () => {
    savedShowIs(show);
    const { wrapper, router } = await openAppAt("/production/stage?view=props");

    await wrapper.get(`main a[href='${PIRATE_PROPS}']`).trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe(PIRATE_PROPS);
    expect(wrapper.get("main h1").text()).toBe("Pirate Sketch");
    expect(wrapper.get("[data-test=position]").text()).toBe("Item 2 · First half");
    expect(document.title).toBe("Pirate Sketch · iCUE");
  });

  it("goes back to the Props page from All items", async () => {
    savedShowIs(show);
    const { wrapper, router } = await openAppAt(PIRATE_PROPS);

    const allItems = wrapper.get("main nav[aria-label='Item navigation'] a");
    expect(allItems.text()).toBe("All items");
    await allItems.trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/production/stage?view=props");
  });

  it("says when no props have been added", async () => {
    savedShowIs(show, [aProp(1, "finale", "Confetti")]);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(wrapper.get("main").text()).toContain("No props have been added yet.");
    expect(propsShown(wrapper)).toEqual([]);
  });

  it("links to the previous and next items' props pages, named by title", async () => {
    savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(stepLinks(wrapper)).toEqual([
      {
        rel: "prev",
        text: "Previous Opening Number",
        href: "/production/stage/props/opening-number",
      },
      { rel: "next", text: "Next Campfire Song", href: "/production/stage/props/campfire-song" },
    ]);
  });

  it("steps across the interval like the casting item page, opening that item's props", async () => {
    savedShowIs(show, [aProp(1, "campfire-song", "Marshmallows")]);
    const { wrapper, router } = await openAppAt(PIRATE_PROPS);

    await wrapper.get("main a[rel=next]").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/production/stage/props/campfire-song");
    expect(wrapper.get("main h1").text()).toBe("Campfire Song");
    expect(propsShown(wrapper)).toEqual(["Marshmallows"]);
    expect(stepLinks(wrapper).map((link) => link.text)).toEqual([
      "Previous Pirate Sketch",
      "Next Finale",
    ]);
    expect(document.title).toBe("Campfire Song · iCUE");
  });

  it("has no Previous on the first item, and no Next on the last", async () => {
    savedShowIs(show);
    const first = await openAppAt("/production/stage/props/opening-number");
    expect(stepLinks(first.wrapper).map((link) => link.rel)).toEqual(["next"]);
    first.wrapper.unmount();

    const { wrapper } = await openAppAt("/production/stage/props/finale");
    expect(stepLinks(wrapper).map((link) => link.rel)).toEqual(["prev"]);
  });

  it("opens the same item's props page from its own address", async () => {
    savedShowIs(show, [aProp(1, "pirate-sketch", "Treasure chest")]);

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(wrapper.get("main h1").text()).toBe("Pirate Sketch");
    expect(propsShown(wrapper)).toEqual(["Treasure chest"]);
  });

  it("has a help button beside the item's name", async () => {
    savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    const row = wrapper.get("main .page-title-row");
    expect(row.get("h1").text()).toBe("Pirate Sketch");
    expect(row.find("button[aria-label='Help for this item']").exists()).toBe(true);
  });

  it("marks Stage as the current page in the menu", async () => {
    savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    const current = wrapper.findAll("nav a[aria-current=page]");
    expect(current.map((link) => link.text())).toEqual(["Stage"]);
  });

  it("says an item that isn't in the running order wasn't found, with a link back to the Props page", async () => {
    savedShowIs(show);
    const { wrapper, router } = await openAppAt("/production/stage/props/no-such-item");

    expect(wrapper.get("main h1").text()).toBe("Item not found");
    expect(document.title).toBe("Item not found · iCUE");
    await wrapper.get("main a.back-link").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/production/stage?view=props");
  });

  it("says the item wasn't found when there's no saved running order", async () => {
    savedShowIs(undefined);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(wrapper.get("main h1").text()).toBe("Item not found");
  });

  it("reports a failed load rather than not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the item.");
    expect(wrapper.get("main").text()).not.toContain("Item not found");
  });

  it("lists props alphabetically, ignoring case, with numbers by value", async () => {
    savedShowIs(show, [
      aProp(1, "pirate-sketch", "umbrella 10"),
      aProp(2, "pirate-sketch", "Treasure chest"),
      aProp(3, "pirate-sketch", "Umbrella 2"),
    ]);

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(propsShown(wrapper)).toEqual(["Treasure chest", "Umbrella 2", "umbrella 10"]);
  });
});

describe("Adding a prop", () => {
  it("adds a prop by name as a card, kept on reload and counted on the Props page, for Stage", async () => {
    await signInAs(["stage"], "pat");
    const stored = savedShowIs(show);
    const first = await openAppAt(PIRATE_PROPS);

    await addProp(first.wrapper, "Treasure chest");

    expect(propsShown(first.wrapper)).toEqual(["Treasure chest"]);
    expect(first.wrapper.text()).not.toContain("No props have been added yet.");
    expect(stored).toEqual([aProp(1, "pirate-sketch", "Treasure chest")]);
    first.wrapper.unmount();

    const { wrapper, router } = await openAppAt(PIRATE_PROPS);
    expect(propsShown(wrapper)).toEqual(["Treasure chest"]);

    await wrapper.get("main nav[aria-label='Item navigation'] a").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("stage");
    const row = wrapper.get("[data-test=item][data-item-id=pirate-sketch]");
    expect(row.get("[data-test=count]").text()).toBe("1 prop");
  });

  it("lets an admin add a prop, as for Stage", async () => {
    await signInAs(["admin"], "alex");
    const stored = savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await addProp(wrapper, "Parrot");

    expect(propsShown(wrapper)).toEqual(["Parrot"]);
    expect(stored).toEqual([aProp(1, "pirate-sketch", "Parrot")]);
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
  ])("says a prop needs a name when it's %s, saving nothing", async (_case, name) => {
    const stored = savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await addProp(wrapper, name);

    expect(errorFor(wrapper, "name")).toBe("A prop needs a name");
    expect(propsShown(wrapper)).toEqual([]);
    expect(stored).toEqual([]);
  });

  it("refuses a name over 80 characters, saving nothing", async () => {
    const stored = savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);

    await addProp(wrapper, "x".repeat(81));

    expect(errorFor(wrapper, "name")).toBe("Prop names can be up to 80 characters");
    expect(stored).toEqual([]);
  });

  it("adds nothing when cancelled", async () => {
    const stored = savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    await wrapper.get("[data-test=add-prop]").trigger("click");
    await wrapper.get("input[name=name]").setValue("Treasure chest");

    await wrapper.get("[data-test=cancel]").trigger("click");
    await flushPromises();

    expect(wrapper.find("form[aria-label='Add prop']").exists()).toBe(false);
    expect(stored).toEqual([]);
  });

  it("says when a prop couldn't be added, keeping the name typed", async () => {
    savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    addingFails();

    await addProp(wrapper, "Treasure chest");

    expect(wrapper.get("form [role=alert]").text()).toBe("Couldn't add the prop. Try again.");
    expect(wrapper.get<HTMLInputElement>("input[name=name]").element.value).toBe("Treasure chest");
    expect(propsShown(wrapper)).toEqual([]);
  });

  it("closes an unsaved Add prop on stepping to the next item, so it can't be added there", async () => {
    const stored = savedShowIs(show);
    const { wrapper } = await openAppAt(PIRATE_PROPS);
    await wrapper.get("[data-test=add-prop]").trigger("click");
    await wrapper.get("input[name=name]").setValue("Treasure chest");

    await wrapper.get("main a[rel=next]").trigger("click");
    await flushPromises();

    expect(wrapper.get("main h1").text()).toBe("Campfire Song");
    expect(wrapper.find("form[aria-label='Add prop']").exists()).toBe(false);
    await wrapper.get("[data-test=add-prop]").trigger("click");
    expect(wrapper.get<HTMLInputElement>("input[name=name]").element.value).toBe("");
    expect(wrapper.find("form [role=alert]").exists()).toBe(false);
    expect(stored).toEqual([]);
  });

  it("offers no Add prop without Stage, saying the props can only be viewed", async () => {
    await signInAs(["casting"], "sam");
    savedShowIs(show, [aProp(1, "pirate-sketch", "Treasure chest")]);

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(wrapper.find("[data-test=add-prop]").exists()).toBe(false);
    expect(wrapper.get("[data-test=read-only]").text()).toBe(
      "You can view the props, but not change them.",
    );
    expect(propsShown(wrapper)).toEqual(["Treasure chest"]);
  });

  it("doesn't say the props are view-only to someone with Stage", async () => {
    await signInAs(["stage"], "pat");
    savedShowIs(show);

    const { wrapper } = await openAppAt(PIRATE_PROPS);

    expect(wrapper.find("[data-test=add-prop]").exists()).toBe(true);
    expect(wrapper.find("[data-test=read-only]").exists()).toBe(false);
  });
});
