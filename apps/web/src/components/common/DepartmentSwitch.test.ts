import { enableAutoUnmount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { json, openAppAt } from "@/app.fixture.ts";
import { runningOrderPath } from "@/services/production.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { departmentPages } from "@/utils/departments.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";

// The department switch on every Production item page, through the real app and router, so
// it opens the real pages.

enableAutoUnmount(afterEach);
beforeEach(useLocalSignIn);
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  useLocalSignIn();
});

// Made-up items, in show order: Opening Number, Pirate Sketch | Finale.
const show = aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")], [anItem("Finale")]);

/** A stand-in API with the running order (or failing to give it) and nothing else yet. */
function apiHolds(order: typeof show | "fails" = show) {
  const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url === runningOrderPath()) return order === "fails" ? json({}, 500) : json(order);
    if (url.endsWith("-notes") || url.endsWith("/item-notes")) {
      return json({ productionId: "2027", notes: [] });
    }
    if (url.endsWith("-files")) return json({ files: [] });
    if (url === "/api/usage") return new Response(null, { status: 204 });
    if (url.startsWith("/api/productions/")) return new Response(null, { status: 404 });
    return json({ status: "ok", version: "dev" });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const switchOf = (wrapper: VueWrapper) => wrapper.find("nav[aria-label=Departments]");
const pageOf = (department: string, item = "pirate-sketch") =>
  `/production/items/${item}/${department}`;

describe("The department switch", () => {
  it("lists every Production department, in the Overview's order", async () => {
    apiHolds();
    const { wrapper } = await openAppAt(pageOf("props"));

    const entries = switchOf(wrapper).findAll("[data-test=department]");
    expect(entries.map((entry) => entry.attributes("data-tooltip"))).toEqual(
      departmentPages.map(({ name }) => name),
    );
  });

  it("opens the chosen department's page for the same item", async () => {
    apiHolds();
    const { wrapper, router } = await openAppAt(pageOf("props"));

    await switchOf(wrapper).get("a[data-tooltip=Wardrobe]").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe(pageOf("wardrobe"));
    expect(wrapper.get("h1").text()).toBe("Wardrobe: Pirate Sketch");
  });

  it("marks the department you're in as current, and links to the others", async () => {
    apiHolds();
    const { wrapper } = await openAppAt(pageOf("mic-plot"));

    const current = switchOf(wrapper).get("[aria-current=page]");
    expect(current.attributes("data-tooltip")).toBe("Mic plot");
    expect(current.element.tagName).not.toBe("A");
    expect(
      switchOf(wrapper)
        .findAll("a")
        .map((link) => link.attributes("href")),
    ).toEqual(["scenery", "props", "sfx", "wardrobe"].map((department) => pageOf(department)));
  });

  it("keeps Previous and Next in the department it opened", async () => {
    apiHolds();
    const { wrapper } = await openAppAt(pageOf("scenery"));

    await switchOf(wrapper).get("a[data-tooltip=Props]").trigger("click");
    await flushPromises();

    expect(wrapper.get("a[rel=prev]").attributes("href")).toBe(pageOf("props", "opening-number"));
    expect(wrapper.get("a[rel=next]").attributes("href")).toBe(pageOf("props", "finale"));
  });

  it.each(departmentPages.map(({ id }) => id))("shows on the %s page", async (department) => {
    apiHolds();
    const { wrapper } = await openAppAt(pageOf(department));

    expect(switchOf(wrapper).exists()).toBe(true);
  });

  it("isn't on the Casting item page", async () => {
    apiHolds();
    const { wrapper } = await openAppAt("/casting/items/pirate-sketch");

    expect(wrapper.get("h1").text()).toBe("Casting: Pirate Sketch");
    expect(switchOf(wrapper).exists()).toBe(false);
  });

  it.each([
    ["an item not in the running order", show, "no-such-item"],
    ["a running order that fails to load", "fails" as const, "pirate-sketch"],
  ])("isn't shown for %s", async (_, order, item) => {
    apiHolds(order);
    const { wrapper } = await openAppAt(pageOf("sfx", item));

    expect(wrapper.find("a.back-link").exists()).toBe(true);
    expect(switchOf(wrapper).exists()).toBe(false);
  });

  it("records a visit to the department it opens", async () => {
    const fetch = apiHolds();
    const { wrapper } = await openAppAt(pageOf("props"));

    await switchOf(wrapper).get("a[data-tooltip=Scenery]").trigger("click");
    await flushPromises();

    const visits = fetch.mock.calls
      .filter(([url]) => url === "/api/usage")
      .map(([, init]) => JSON.parse(String(init?.body)));
    expect(visits).toContainEqual({
      event: "scenery",
      productionId: "2027",
      itemId: "pirate-sketch",
    });
  });

  it("is the same for someone who can only view the Production pages", async () => {
    apiHolds();
    signInAs([]);
    const { wrapper } = await openAppAt(pageOf("props"));

    expect(switchOf(wrapper).findAll("[data-test=department]")).toHaveLength(
      departmentPages.length,
    );
    expect(switchOf(wrapper).findAll("a")).toHaveLength(departmentPages.length - 1);
  });

  it("names each department for screen readers, whatever the screen's width", async () => {
    apiHolds();
    const { wrapper } = await openAppAt(pageOf("sfx"));

    const entries = switchOf(wrapper).findAll("[data-test=department]");
    expect(entries.map((entry) => entry.text())).toEqual(departmentPages.map(({ name }) => name));
    for (const entry of entries) {
      expect(entry.get("svg").attributes("aria-hidden")).toBe("true");
    }
  });
});
