import type { Prop, RunningOrder } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "@/App.vue";
import { createAppRouter } from "@/router/index.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { PROPS_PATH } from "@/utils/props.ts";
import { PROPS_NOTES_PATH } from "@/utils/props-notes.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";
import { RUNNING_ORDER_PATH } from "@/utils/running-order.ts";

enableAutoUnmount(afterEach);
// As on pnpm dev: everyone acts as an admin, unless a test signs someone in.
beforeEach(useLocalSignIn);
afterEach(() => {
  vi.unstubAllGlobals();
  useLocalSignIn();
  document.body.innerHTML = "";
});

/** A stand-in API answering the running order, props and props notes paths as given (no
 *  props notes unless a test says). */
function apiAnswers(answers: {
  order: () => Response;
  props: () => Response;
  notes?: () => Response;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === RUNNING_ORDER_PATH) return answers.order();
      if (url === PROPS_PATH) return answers.props();
      if (url === PROPS_NOTES_PATH) {
        return answers.notes?.() ?? json({ productionId: "2027", notes: [] })();
      }
      if (url === "/api/usage") return new Response(null, { status: 204 });
      return json({ status: "ok", version: "dev" })();
    }),
  );
}

const json = (body: unknown) => () => new Response(JSON.stringify(body));
const status = (code: number) => () => new Response(null, { status: code });

function savedShowIs(order: RunningOrder, props: Prop[] = []) {
  apiAnswers({ order: json(order), props: json({ productionId: "2027", props }) });
}

const aProp = (id: number, itemTitle: string): Prop => ({
  id,
  itemId: anItem(itemTitle).id,
  name: `Prop ${id}`,
  roleIds: [],
});

// Made-up items: items 1 and 2 in the first half, and the Finale as item 14 in the second
// (each half is numbered from 1).
const show = () =>
  aRunningOrder(
    [anItem("Opening Number"), anItem("Pirate Sketch")],
    [...Array.from({ length: 13 }, (_, i) => anItem(`Song ${i + 1}`)), anItem("Finale")],
  );

async function openOverview(path = "/production/overview") {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return { wrapper, router };
}

const titlesIn = (wrapper: VueWrapper, halfName: string) =>
  wrapper
    .findAll("main section")
    .find((section) => section.find("h2").text() === halfName)
    ?.findAll("[data-test=title]")
    .map((title) => title.text());

const rowFor = (wrapper: VueWrapper, title: string) =>
  wrapper.findAll("[data-test=item]").find((row) => row.get("[data-test=title]").text() === title);

describe("Production overview", () => {
  it("is titled Overview, with a help button and no view switch", async () => {
    savedShowIs(show());

    const { wrapper } = await openOverview();

    expect(wrapper.get("main h1").text()).toBe("Overview");
    expect(
      wrapper.find(".page-title-row button[aria-label='Help for Production overview']").exists(),
    ).toBe(true);
    expect(wrapper.find("main .view-switch").exists()).toBe(false);
    expect(wrapper.find("main [aria-pressed]").exists()).toBe(false);
  });

  it("records each visit as a use of the Production overview", async () => {
    savedShowIs(show());

    await openOverview();

    const pageUses = vi
      .mocked(fetch)
      .mock.calls.filter(([url, init]) => url === "/api/usage" && init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body)))
      .filter((body) => body.event === "page");
    expect(pageUses).toEqual([{ event: "page", page: "production-overview" }]);
  });

  it("opens for someone with no permissions", async () => {
    await signInAs([], "jo");
    savedShowIs(show());

    const { wrapper } = await openOverview();

    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
  });

  it("lists each half under its name, with its items in running order", async () => {
    savedShowIs(show());

    const { wrapper } = await openOverview();

    expect(wrapper.findAll("main .half h2").map((h2) => h2.text())).toEqual([
      "First half",
      "Second half",
    ]);
    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
    expect(titlesIn(wrapper, "Second half")?.at(-1)).toBe("Finale");
  });

  it("heads its columns Open, #, Item and Props, with no minutes", async () => {
    savedShowIs(show());

    const { wrapper } = await openOverview();

    const headings = wrapper.get("main table").findAll("thead th");
    expect(headings.map((th) => th.text())).toEqual(["Open", "#", "Item", "Props"]);
    expect(wrapper.find("[data-test=minutes]").exists()).toBe(false);
  });

  it("shows each item's number and title", async () => {
    savedShowIs(show());

    const { wrapper } = await openOverview();

    const numberOf = (title: string) => rowFor(wrapper, title)?.get("[data-test=number]").text();
    expect(numberOf("Opening Number")).toBe("1");
    expect(numberOf("Pirate Sketch")).toBe("2");
    expect(numberOf("Finale")).toBe("14");
  });

  it("marks an item not in the printed programme, with no number", async () => {
    savedShowIs(
      aRunningOrder([
        anItem("Opening Number"),
        anItem("Interval Announcement", { printed: false }),
        anItem("Pirate Sketch"),
      ]),
    );

    const { wrapper } = await openOverview();

    const announcement = rowFor(wrapper, "Interval Announcement");
    expect(announcement?.classes()).toContain("not-printed");
    expect(announcement?.get("[data-test=number]").text()).toBe("Not in printed programme");
    expect(announcement?.get("[data-test=number]").text()).not.toMatch(/\d/);
    expect(rowFor(wrapper, "Pirate Sketch")?.get("[data-test=number]").text()).toBe("2");
  });

  it("shows each item's props count as a number, labelled for screen readers", async () => {
    savedShowIs(show(), [
      aProp(1, "Pirate Sketch"),
      aProp(2, "Pirate Sketch"),
      aProp(3, "Opening Number"),
      aProp(4, "Pirate Sketch"),
    ]);

    const { wrapper } = await openOverview();

    const countOf = (title: string) => rowFor(wrapper, title)?.get("[data-test=count]");
    expect(countOf("Pirate Sketch")?.get("[aria-hidden=true]").text()).toBe("3");
    expect(countOf("Pirate Sketch")?.get(".visually-hidden").text()).toBe("3 props");
    expect(countOf("Opening Number")?.get("[aria-hidden=true]").text()).toBe("1");
    expect(countOf("Opening Number")?.get(".visually-hidden").text()).toBe("1 prop");
    expect(countOf("Finale")?.get("[aria-hidden=true]").text()).toBe("0");
    expect(countOf("Finale")?.attributes("data-label")).toBe("Props");
  });

  describe("with Stage", () => {
    beforeEach(() => signInAs(["stage"], "pat"));

    it("has a square Props button in each row, with a luggage icon and a tooltip, named for its item, that opens the item's props", async () => {
      savedShowIs(show());
      const { wrapper, router } = await openOverview();

      const button = rowFor(wrapper, "Pirate Sketch")?.get("[data-test=open-props]");
      expect(button?.attributes("aria-label")).toBe("Edit props for Pirate Sketch");
      expect(button?.classes()).toContain("icon-button");
      expect(button?.find("svg.fa-person-walking-luggage").exists()).toBe(true);
      expect(button?.attributes("data-tooltip")).toBe("Edit this item's props");
      expect(
        rowFor(wrapper, "Finale")?.get("[data-test=open-props]").attributes("aria-label"),
      ).toBe("Edit props for Finale");

      await button?.trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("props-item");
      expect(router.currentRoute.value.params.itemId).toBe("pirate-sketch");
    });
  });

  it("gives an admin the edit button", async () => {
    await signInAs(["admin"], "alex");
    savedShowIs(show());

    const { wrapper } = await openOverview();

    expect(
      rowFor(wrapper, "Pirate Sketch")?.get("[data-test=open-props]").attributes("aria-label"),
    ).toBe("Edit props for Pirate Sketch");
  });

  describe("without Stage", () => {
    beforeEach(() => signInAs(["casting"], "sam"));

    it("has a view button in each row, named for its item, that opens the item's props", async () => {
      savedShowIs(show());
      const { wrapper, router } = await openOverview();

      const button = rowFor(wrapper, "Pirate Sketch")?.get("[data-test=open-props]");
      expect(button?.attributes("aria-label")).toBe("View props for Pirate Sketch");
      expect(button?.find("svg.fa-person-walking-luggage").exists()).toBe(true);
      expect(button?.attributes("data-tooltip")).toBe("View this item's props");

      await button?.trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("props-item");
      expect(router.currentRoute.value.params.itemId).toBe("pirate-sketch");
    });
  });

  it("says there's no running order yet, linking to the Running order page", async () => {
    apiAnswers({ order: status(404), props: json({ productionId: "2027", props: [] }) });

    const { wrapper } = await openOverview();

    expect(wrapper.get("main").text()).toContain("There's no saved running order yet.");
    expect(wrapper.get("main a[href='/running-order']").text()).toBe("Running order page");
    expect(wrapper.find("main table").exists()).toBe(false);
  });

  it("says it couldn't load the items, not that there's no running order, when the load fails", async () => {
    apiAnswers({ order: status(500), props: json({ productionId: "2027", props: [] }) });

    const { wrapper } = await openOverview();

    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the items.");
    expect(wrapper.get("main").text()).not.toContain("no saved running order");
  });

  it("still shows the items when the props can't be loaded, with no count reading 0", async () => {
    apiAnswers({ order: json(show()), props: status(500) });

    const { wrapper } = await openOverview();

    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the props counts.");
    const counts = wrapper.findAll("[data-test=count]").map((cell) => cell.text());
    expect(counts.length).toBeGreaterThan(0);
    for (const count of counts) expect(count).not.toMatch(/\d/);
  });
});

describe("Old addresses", () => {
  beforeEach(() => savedShowIs(show()));

  it.each([
    "/production/stage",
    "/production/stage?view=props",
    "/production/stage?view=scenery",
    "/production/tech",
    "/production/tech?view=sfx",
    "/production/tech?view=mic-plot",
    "/production/wardrobe",
    "/production/costume",
    "/production/scenery",
    "/production/props",
    "/production/mic-plot",
    "/production/sfx",
  ])("opens %s as the Overview", async (path) => {
    const { wrapper, router } = await openOverview(path);

    expect(router.currentRoute.value.fullPath).toBe("/production/overview");
    expect(wrapper.get("main h1").text()).toBe("Overview");
  });

  it("still opens a bookmarked item's props page", async () => {
    const { router } = await openOverview("/production/stage/props/pirate-sketch");

    expect(router.currentRoute.value.fullPath).toBe("/production/items/pirate-sketch/props");
  });
});

describe("Props notes on the Production overview", () => {
  const withNotes = (notes: { itemId: string; text: string; revision: number }[]) =>
    apiAnswers({
      order: json(show()),
      props: json({ productionId: "2027", props: [] }),
      notes: json({ productionId: "2027", notes }),
    });

  /** The notes shown for an item: in the row straight after the item's own row. */
  const notesFor = (wrapper: VueWrapper, title: string) => {
    const row = rowFor(wrapper, title)?.element.nextElementSibling;
    return row?.matches("[data-test=props-notes]") ? row : undefined;
  };

  it("shows an item's props notes in full, under its row and across the table", async () => {
    withNotes([
      { itemId: "pirate-sketch", text: "Chest set stage left before the blackout", revision: 1 },
    ]);

    const { wrapper } = await openOverview();

    const notes = notesFor(wrapper, "Pirate Sketch");
    expect(notes?.textContent?.trim()).toBe("Chest set stage left before the blackout");
    expect(notes?.querySelector("td")?.getAttribute("colspan")).toBe("4");
    expect(notes?.querySelector("td")?.getAttribute("data-label")).toBe("Props notes");
  });

  it("shows nothing extra for an item with no props notes, or cleared ones", async () => {
    withNotes([{ itemId: "opening-number", text: "", revision: 2 }]);

    const { wrapper } = await openOverview();

    expect(notesFor(wrapper, "Finale")).toBeUndefined();
    expect(notesFor(wrapper, "Opening Number")).toBeUndefined();
    expect(wrapper.findAll("[data-test=props-notes]")).toEqual([]);
  });

  it("still lists the items, and says so, when the props notes can't be loaded", async () => {
    apiAnswers({
      order: json(show()),
      props: json({ productionId: "2027", props: [] }),
      notes: status(500),
    });

    const { wrapper } = await openOverview();

    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the notes.");
  });
});
