import type { Role, RunningOrder } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import { ROLES_PATH } from "../roles.ts";
import { createAppRouter } from "../router.ts";
import { anItem, aRunningOrder } from "../running-order.fixture.ts";
import { RUNNING_ORDER_PATH } from "../running-order.ts";
import CastingItemsPage from "./CastingItemsPage.vue";

enableAutoUnmount(afterEach);

/** A stand-in API: the saved running order, and the production's roles (none by default). */
function savedRunningOrderIs(order: RunningOrder, roles: Role[] = []) {
  const fetch = vi.fn(async (url: string) =>
    url === ROLES_PATH
      ? new Response(JSON.stringify({ productionId: "2027", roles }))
      : new Response(JSON.stringify(order)),
  );
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

    // One read of the saved version (the roles are fetched separately, for the counts).
    expect(fetch.mock.calls.filter(([url]) => url === RUNNING_ORDER_PATH)).toHaveLength(1);
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

  it("gives each item a Cast button that opens its page", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]));

    const wrapper = await openItemsPage();

    const cast = rowFor(wrapper, "Pirate Sketch")?.get("[data-test=cast]");
    expect(cast?.attributes("href")).toBe("/casting/items/pirate-sketch");
    expect(cast?.attributes("aria-label")).toBe("Cast Pirate Sketch");
    expect(cast?.attributes("data-tooltip")).toBe("Cast this item");
    expect(cast?.get("svg[aria-hidden=true]").attributes("data-icon")).toBe("users");
    // In the first column, where the Running order has its move and edit buttons.
    expect(rowFor(wrapper, "Pirate Sketch")?.get("td").find("[data-test=cast]").exists()).toBe(
      true,
    );
  });

  // The Running order's stacked phone layout pads and separates rows by data-item-id.
  it("marks each row with its item, so small screens separate items as on the Running order", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number"), anItem("Pirate Sketch")]));

    const wrapper = await openItemsPage();

    expect(rowFor(wrapper, "Pirate Sketch")?.attributes("data-item-id")).toBe("pirate-sketch");
  });

  it("lays the items out in Cast, number, item and roles columns", async () => {
    savedRunningOrderIs(aRunningOrder([anItem("Opening Number")]));

    const wrapper = await openItemsPage();

    expect(
      wrapper
        .get("section")
        .findAll("thead th")
        .map((th) => th.text()),
    ).toEqual(["Cast", "#", "Item", "Roles"]);
  });
});

describe("Casting items page role counts", () => {
  afterEach(() => vi.unstubAllGlobals());

  let nextId = 1;
  const aRole = (itemId: string, size: Role["size"], castMemberIds: number[] = []): Role => ({
    id: nextId,
    itemId,
    name: `Role ${nextId++}`,
    size,
    castMemberIds,
    revision: 1,
  });

  const show = aRunningOrder([
    anItem("Opening Number"),
    anItem("Pirate Sketch"),
    anItem("Campfire Song"),
  ]);
  const countsFor = (wrapper: VueWrapper, title: string) =>
    rowFor(wrapper, title)?.get("[data-test=counts]");

  it("shows each item's total roles and roles cast", async () => {
    savedRunningOrderIs(show, [
      aRole("pirate-sketch", "lead", [12]),
      aRole("pirate-sketch", "support", [13]),
      aRole("pirate-sketch", "support", [14]),
      aRole("pirate-sketch", "cameo"),
      aRole("pirate-sketch", "cameo"),
    ]);

    const wrapper = await openItemsPage();

    expect(countsFor(wrapper, "Pirate Sketch")?.get("[aria-hidden=true]").text()).toBe(
      "Roles 5 · Cast 3",
    );
  });

  it("says when an item has no roles yet", async () => {
    savedRunningOrderIs(show, [aRole("pirate-sketch", "lead")]);

    const wrapper = await openItemsPage();

    expect(countsFor(wrapper, "Campfire Song")?.text()).toBe("No roles yet");
  });

  it("counts an ensemble as cast once anyone is in it", async () => {
    savedRunningOrderIs(show, [
      aRole("opening-number", "lead", [12]),
      aRole("opening-number", "ensemble", [13, 14]),
      aRole("opening-number", "cameo"),
    ]);

    const wrapper = await openItemsPage();

    expect(countsFor(wrapper, "Opening Number")?.get("[aria-hidden=true]").text()).toBe(
      "Roles 3 · Cast 2",
    );
  });

  it("reads the counts out in words", async () => {
    savedRunningOrderIs(show, [
      aRole("pirate-sketch", "lead", [12]),
      aRole("pirate-sketch", "support", [13]),
      aRole("pirate-sketch", "cameo"),
    ]);

    const wrapper = await openItemsPage();

    expect(countsFor(wrapper, "Pirate Sketch")?.get(".visually-hidden").text()).toBe(
      "3 roles, 2 cast",
    );
  });

  it("uses '1 role' for a single role", async () => {
    savedRunningOrderIs(show, [aRole("pirate-sketch", "lead")]);

    const wrapper = await openItemsPage();

    expect(countsFor(wrapper, "Pirate Sketch")?.get(".visually-hidden").text()).toBe(
      "1 role, 0 cast",
    );
  });

  it("reports roles that can't be loaded, still listing the items without counts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === ROLES_PATH
          ? new Response(null, { status: 500 })
          : new Response(JSON.stringify(show)),
      ),
    );

    const wrapper = await openItemsPage();

    expect(titlesIn(wrapper, "First half")).toEqual([
      "Opening Number",
      "Pirate Sketch",
      "Campfire Song",
    ]);
    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the role counts.");
    expect(wrapper.text()).not.toContain("No roles yet");
    expect(wrapper.findAll("[data-test=counts]").every((cell) => cell.text() === "")).toBe(true);
  });
});
