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
import { SCENERY_FILE_COUNTS_PATH } from "@/utils/scenery.ts";

enableAutoUnmount(afterEach);
// As on pnpm dev: everyone acts as an admin, unless a test signs someone in.
beforeEach(useLocalSignIn);
afterEach(() => {
  vi.unstubAllGlobals();
  useLocalSignIn();
  document.body.innerHTML = "";
});

/** A stand-in API answering the running order, props, props notes and scenery counts paths as
 *  given (no props notes or scenery files unless a test says). */
function apiAnswers(answers: {
  order: () => Response;
  props: () => Response;
  notes?: () => Response;
  scenery?: () => Response;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === RUNNING_ORDER_PATH) return answers.order();
      if (url === PROPS_PATH) return answers.props();
      if (url === SCENERY_FILE_COUNTS_PATH) {
        return answers.scenery?.() ?? json({ counts: {} })();
      }
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

const aProp = (id: number, itemTitle: string, quantity = 1): Prop => ({
  id,
  itemId: anItem(itemTitle).id,
  name: `Prop ${id}`,
  quantity,
  roleIds: [],
  carrierIds: [],
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

/** A department's count cell in an item's row. */
const countIn = (wrapper: VueWrapper, title: string, department: string) =>
  rowFor(wrapper, title)?.get(`[data-test=count][data-department=${department}]`);

/** What a count cell shows: its number, and the small word under it. */
const shown = (cell: ReturnType<typeof countIn>) =>
  cell && {
    number: cell.get("[data-test=count-number]").text(),
    word: cell.get("[data-test=count-word]").text(),
  };

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

  it("opens the Overview's help from its help button", async () => {
    savedShowIs(show());
    const { wrapper } = await openOverview();

    await wrapper
      .get(".page-title-row button[aria-label='Help for Production overview']")
      .trigger("click");

    const dialog = wrapper.get("dialog.help-dialog");
    expect(dialog.get("h2").text()).toBe("Production overview help");
    expect(dialog.findAll("[data-test=help-name]").map((name) => name.text())).toEqual([
      "Scenery",
      "Props",
      "SFX",
      "Mic plot",
      "Wardrobe",
      "Generate Props List",
    ]);
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

  it("heads a count column for each department after the title, in button order, with no minutes", async () => {
    savedShowIs(show());

    const { wrapper } = await openOverview();

    const headings = wrapper.get("main table").findAll("thead th");
    expect(headings.map((th) => th.text())).toEqual([
      "Open",
      "#",
      "Item",
      "Scenery",
      "Props",
      "SFX",
      "Mic plot",
      "Wardrobe",
    ]);
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

  it("shows each item's props count as a number over a small word, read as one phrase", async () => {
    savedShowIs(show(), [
      aProp(1, "Pirate Sketch"),
      aProp(2, "Pirate Sketch"),
      aProp(3, "Opening Number"),
      aProp(4, "Pirate Sketch"),
    ]);

    const { wrapper } = await openOverview();

    const countOf = (title: string) => countIn(wrapper, title, "props");
    expect(shown(countOf("Pirate Sketch"))).toEqual({ number: "3", word: "props" });
    expect(countOf("Pirate Sketch")?.get(".visually-hidden").text()).toBe("3 props");
    expect(shown(countOf("Opening Number"))).toEqual({ number: "1", word: "prop" });
    expect(countOf("Opening Number")?.get(".visually-hidden").text()).toBe("1 prop");
    expect(shown(countOf("Finale"))).toEqual({ number: "0", word: "props" });
    expect(countOf("Finale")?.attributes("data-label")).toBe("Props");
  });

  it("adds up an item's prop quantities in its count", async () => {
    savedShowIs(show(), [aProp(1, "Pirate Sketch", 10), aProp(2, "Pirate Sketch")]);

    const { wrapper } = await openOverview();

    const count = countIn(wrapper, "Pirate Sketch", "props");
    expect(shown(count)?.number).toBe("11");
    expect(count?.get(".visually-hidden").text()).toBe("11 props");
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
      expect(button?.attributes("data-tooltip")).toBe("Props");
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
      expect(button?.attributes("data-tooltip")).toBe("Props");

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
    const counts = wrapper
      .findAll("[data-test=count][data-department=props]")
      .map((cell) => cell.text());
    expect(counts.length).toBeGreaterThan(0);
    for (const count of counts) expect(count).not.toMatch(/\d/);
  });
});

describe("Department buttons on the Production overview", () => {
  const buttonsIn = (wrapper: VueWrapper, title: string) =>
    rowFor(wrapper, title)?.findAll("td.moves .icon-button") ?? [];
  const namesIn = (wrapper: VueWrapper, title: string) =>
    buttonsIn(wrapper, title).map((button) => button.attributes("aria-label"));

  it("has five square buttons in each row, Scenery, Props, SFX, Mic plot and Wardrobe, each with its own icon", async () => {
    savedShowIs(show());
    const { wrapper } = await openOverview();

    const buttons = buttonsIn(wrapper, "Opening Number");
    expect(buttons.map((button) => button.attributes("data-tooltip"))).toEqual([
      "Scenery",
      "Props",
      "SFX",
      "Mic plot",
      "Wardrobe",
    ]);
    const icons = ["hammer", "person-walking-luggage", "file-audio", "microphone", "shirt"];
    expect(buttons.map((button, i) => button.find(`svg.fa-${icons[i]}`).exists())).toEqual(
      icons.map(() => true),
    );
    expect(buttons.every((button) => button.get("svg").attributes("aria-hidden") === "true")).toBe(
      true,
    );
  });

  it("names each button for its department, item and whether it can be changed", async () => {
    await signInAs(["tech"], "pat");
    savedShowIs(show());
    const { wrapper } = await openOverview();

    expect(namesIn(wrapper, "Opening Number")).toEqual([
      "Edit scenery for Opening Number",
      "View props for Opening Number",
      "Edit SFX for Opening Number",
      "Edit mic plot for Opening Number",
      "View wardrobe for Opening Number",
    ]);
  });

  it.each([
    [["stage"], "Edit scenery for Opening Number"],
    [["tech"], "Edit scenery for Opening Number"],
    [["casting"], "View scenery for Opening Number"],
  ])(
    "names the Scenery button for %s as %s, as Stage and Tech share scenery",
    async (groups, name) => {
      await signInAs(groups, "lee");
      savedShowIs(show());
      const { wrapper } = await openOverview();

      expect(namesIn(wrapper, "Opening Number")[0]).toBe(name);
    },
  );

  it("names every department's button Edit for a Director", async () => {
    await signInAs(["director"], "dee");
    savedShowIs(show());
    const { wrapper } = await openOverview();

    expect(namesIn(wrapper, "Opening Number")).toEqual([
      "Edit scenery for Opening Number",
      "Edit props for Opening Number",
      "Edit SFX for Opening Number",
      "Edit mic plot for Opening Number",
      "Edit wardrobe for Opening Number",
    ]);
  });

  it("names every button Edit for an admin", async () => {
    await signInAs(["admin"], "alex");
    savedShowIs(show());
    const { wrapper } = await openOverview();

    const names = wrapper
      .findAll("[data-test=item]")
      .flatMap((row) => row.findAll("td.moves .icon-button"))
      .map((button) => button.attributes("aria-label"));
    expect(names).toHaveLength(16 * 5);
    expect(names.every((name) => name?.startsWith("Edit "))).toBe(true);
  });

  it.each([
    ["Scenery", "scenery-item", "/production/items/opening-number/scenery"],
    ["SFX", "sfx-item", "/production/items/opening-number/sfx"],
    ["Mic plot", "mic-plot-item", "/production/items/opening-number/mic-plot"],
    ["Wardrobe", "wardrobe-item", "/production/items/opening-number/wardrobe"],
  ])("opens the %s page for the item", async (department, name, path) => {
    savedShowIs(show());
    const { wrapper, router } = await openOverview();

    const button = buttonsIn(wrapper, "Opening Number").find(
      (b) => b.attributes("data-tooltip") === department,
    );
    await button?.trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe(name);
    expect(router.currentRoute.value.fullPath).toBe(path);
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
    expect(notes?.querySelector("td")?.getAttribute("colspan")).toBe(
      String(wrapper.get("main table").findAll("thead th").length),
    );
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

describe("Scenery counts on the Production overview", () => {
  const sceneryCounts = (counts: Record<string, number>) => json({ counts });
  const showWithFiles = (counts: Record<string, number>) =>
    apiAnswers({
      order: json(show()),
      props: json({ productionId: "2027", props: [aProp(1, "Opening Number")] }),
      scenery: sceneryCounts(counts),
    });

  it("shows each item's scenery file count over the word files, or file for one", async () => {
    showWithFiles({ [anItem("Opening Number").id]: 9, [anItem("Finale").id]: 1 });

    const { wrapper } = await openOverview();

    expect(shown(countIn(wrapper, "Opening Number", "scenery"))).toEqual({
      number: "9",
      word: "files",
    });
    expect(shown(countIn(wrapper, "Finale", "scenery"))).toEqual({ number: "1", word: "file" });
    expect(countIn(wrapper, "Opening Number", "scenery")?.attributes("data-label")).toBe("Scenery");
  });

  it("asks storage again on each visit, so a file added outside the app is counted", async () => {
    const counts = { [anItem("Opening Number").id]: 2 };
    apiAnswers({
      order: json(show()),
      props: json({ productionId: "2027", props: [] }),
      scenery: () => json({ counts })(),
    });
    await openOverview();
    counts[anItem("Opening Number").id] = 3;

    const { wrapper } = await openOverview();

    expect(shown(countIn(wrapper, "Opening Number", "scenery"))?.number).toBe("3");
  });

  it("shows 0 for an item with no scenery files and no props", async () => {
    showWithFiles({});

    const { wrapper } = await openOverview();

    expect(shown(countIn(wrapper, "Finale", "scenery"))).toEqual({ number: "0", word: "files" });
    expect(shown(countIn(wrapper, "Finale", "props"))).toEqual({ number: "0", word: "props" });
  });

  it("reads each count to screen readers as one phrase, not a number and a word apart", async () => {
    showWithFiles({ [anItem("Opening Number").id]: 9 });

    const { wrapper } = await openOverview();

    const scenery = countIn(wrapper, "Opening Number", "scenery");
    expect(scenery?.get(".visually-hidden").text()).toBe("9 scenery files");
    expect(scenery?.get("[data-test=count-number]").attributes("aria-hidden")).toBe("true");
    expect(scenery?.get("[data-test=count-word]").attributes("aria-hidden")).toBe("true");
    const props = countIn(wrapper, "Opening Number", "props");
    expect(props?.get(".visually-hidden").text()).toBe("1 prop");
    expect(props?.get("[data-test=count-word]").attributes("aria-hidden")).toBe("true");
  });

  it.each([
    ["sfx", "SFX"],
    ["mic-plot", "Mic plot"],
    ["wardrobe", "Wardrobe"],
  ])("shows a dash in every item's %s cell, read as Coming soon", async (department, label) => {
    showWithFiles({});

    const { wrapper } = await openOverview();

    const cells = wrapper.findAll(`[data-test=count][data-department=${department}]`);
    expect(cells).toHaveLength(show().halves.flatMap((half) => half.items).length);
    for (const cell of cells) {
      expect(cell.get("[aria-hidden=true]").text()).toBe("–");
      expect(cell.get(".visually-hidden").text()).toBe("Coming soon");
      expect(cell.attributes("data-label")).toBe(label);
    }
  });

  it("still shows the items and props counts when the scenery counts fail, with no scenery 0", async () => {
    apiAnswers({
      order: json(show()),
      props: json({ productionId: "2027", props: [aProp(1, "Opening Number")] }),
      scenery: status(500),
    });

    const { wrapper } = await openOverview();

    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
    expect(shown(countIn(wrapper, "Opening Number", "props"))?.number).toBe("1");
    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the scenery counts.");
    const cells = wrapper.findAll("[data-test=count][data-department=scenery]");
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(cell.text()).toBe("");
  });
});
