import type { ItemMicPlot, Prop, RunningOrder } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "@/App.vue";
import { createAppRouter } from "@/router/index.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { fileCountsPath } from "@/utils/item-files.ts";
import { departmentNotesPath } from "@/utils/item-notes.ts";
import { MIC_PLOT_PATH } from "@/utils/mic-plot.ts";
import { PROPS_PATH } from "@/utils/props.ts";
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

const SCENERY_FILE_COUNTS_PATH = fileCountsPath("scenery");
const SFX_FILE_COUNTS_PATH = fileCountsPath("sfx");
const WARDROBE_FILE_COUNTS_PATH = fileCountsPath("wardrobe");
const SCENERY_NOTES_PATH = departmentNotesPath("scenery");
const SFX_NOTES_PATH = departmentNotesPath("sfx");
const WARDROBE_NOTES_PATH = departmentNotesPath("wardrobe");

/** A stand-in API answering the running order, props, notes, file counts and mic plot paths
 *  as given (no notes, files or mics unless a test says). */
function apiAnswers(answers: {
  order: () => Response;
  props: () => Response;
  notes?: () => Response;
  sceneryNotes?: () => Response;
  sfxNotes?: () => Response;
  wardrobeNotes?: () => Response;
  micPlotNotes?: () => Response;
  micPlot?: () => Response;
  scenery?: () => Response;
  sfx?: () => Response;
  wardrobe?: () => Response;
}) {
  const noNotes = json({ productionId: "2027", notes: [] });
  const noFiles = json({ counts: {} });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === RUNNING_ORDER_PATH) return answers.order();
      if (url === PROPS_PATH) return answers.props();
      if (url === SCENERY_FILE_COUNTS_PATH) return (answers.scenery ?? noFiles)();
      if (url === SFX_FILE_COUNTS_PATH) return (answers.sfx ?? noFiles)();
      if (url === WARDROBE_FILE_COUNTS_PATH) return (answers.wardrobe ?? noFiles)();
      if (url === SFX_NOTES_PATH) return (answers.sfxNotes ?? noNotes)();
      if (url === WARDROBE_NOTES_PATH) return (answers.wardrobeNotes ?? noNotes)();
      if (url === departmentNotesPath("mic-plot")) return (answers.micPlotNotes ?? noNotes)();
      if (url === MIC_PLOT_PATH) {
        return (answers.micPlot ?? json({ productionId: "2027", items: [] }))();
      }
      if (url === departmentNotesPath("props")) {
        return answers.notes?.() ?? json({ productionId: "2027", notes: [] })();
      }
      if (url === SCENERY_NOTES_PATH) {
        return answers.sceneryNotes?.() ?? json({ productionId: "2027", notes: [] })();
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
  it("shows the saved draft's number as the Running order page words it", async () => {
    savedShowIs(aRunningOrder([anItem("Opening Number")], [], 3));

    const { wrapper } = await openOverview();

    expect(wrapper.get("[data-test=version]").text()).toBe("Draft 3");
    expect(wrapper.get("main").text()).not.toContain("Based on");
  });

  it("shows one alert naming every part that couldn't be loaded, above the items", async () => {
    apiAnswers({
      order: json(show()),
      props: status(500),
      micPlot: status(500),
      notes: status(500),
    });

    const { wrapper } = await openOverview();

    expect(wrapper.findAll("main [role=alert]").map((alert) => alert.text())).toEqual([
      "Couldn't load the props counts, the mic plot counts and the notes.",
    ]);
    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
    const alert = wrapper.get("main [role=alert]").element;
    const items = wrapper.get("main section").element;
    expect(alert.compareDocumentPosition(items) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no alert when everything loads", async () => {
    savedShowIs(show());

    const { wrapper } = await openOverview();

    expect(wrapper.find("main [role=alert]").exists()).toBe(false);
  });

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
    expect(dialog.get("p").text()).toContain("The show's items in running order");
    expect(dialog.findAll("[data-test=help-name]").map((name) => name.text())).toEqual([
      "Scenery",
      "Props",
      "SFX",
      "Mic plot",
      "Wardrobe",
      "Generate Props List",
      "Generate Mic Plot",
    ]);
  });

  it("goes straight from the title to the running order, with no description line", async () => {
    savedShowIs(show());

    const { wrapper } = await openOverview();

    // The announcement is for screen readers only, so it shows nothing between them.
    const shown = wrapper
      .findAll("main > *")
      .filter((element) => !element.classes("visually-hidden"));
    expect(shown[0]?.classes()).toContain("page-title-row");
    expect(shown[1]?.attributes("data-test")).toBe("version");
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

describe("Scenery notes on the Production overview", () => {
  type Note = { itemId: string; text: string; revision: number };
  const withNotes = (scenery: Note[], props: Note[] = []) =>
    apiAnswers({
      order: json(show()),
      props: json({ productionId: "2027", props: [] }),
      sceneryNotes: json({ productionId: "2027", notes: scenery }),
      notes: json({ productionId: "2027", notes: props }),
    });

  /** The notes rows straight after the item's own row, each as its label and text. */
  const notesUnder = (wrapper: VueWrapper, title: string) => {
    const shown: { label: string | null | undefined; text: string | undefined }[] = [];
    let row = rowFor(wrapper, title)?.element.nextElementSibling;
    while (row?.matches(".item-notes-row")) {
      const cell = row.querySelector("td");
      shown.push({ label: cell?.getAttribute("data-label"), text: cell?.textContent?.trim() });
      row = row.nextElementSibling;
    }
    return shown;
  };

  it("shows an item's scenery notes in full, under its row and across the table", async () => {
    withNotes([
      { itemId: "pirate-sketch", text: "Fly the cloud in after the blackout", revision: 1 },
    ]);

    const { wrapper } = await openOverview();

    expect(notesUnder(wrapper, "Pirate Sketch")).toEqual([
      { label: "Scenery notes", text: "Fly the cloud in after the blackout" },
    ]);
    const cell = wrapper.get("[data-test=scenery-notes] td");
    expect(cell.attributes("colspan")).toBe(
      String(wrapper.get("main table").findAll("thead th").length),
    );
  });

  it("shows the scenery notes before the props notes, as the row shows Scenery before Props", async () => {
    withNotes(
      [{ itemId: "pirate-sketch", text: "Fly the cloud in after the blackout", revision: 1 }],
      [{ itemId: "pirate-sketch", text: "Chest set stage left before the blackout", revision: 1 }],
    );

    const { wrapper } = await openOverview();

    expect(notesUnder(wrapper, "Pirate Sketch")).toEqual([
      { label: "Scenery notes", text: "Fly the cloud in after the blackout" },
      { label: "Props notes", text: "Chest set stage left before the blackout" },
    ]);
  });

  it("shows nothing extra for an item with no scenery notes, or cleared ones", async () => {
    withNotes([{ itemId: "opening-number", text: "", revision: 2 }]);

    const { wrapper } = await openOverview();

    expect(notesUnder(wrapper, "Opening Number")).toEqual([]);
    expect(wrapper.findAll("[data-test=scenery-notes]")).toEqual([]);
  });

  it("still lists the items and their props notes, and says so, when the scenery notes can't be loaded", async () => {
    apiAnswers({
      order: json(show()),
      props: json({ productionId: "2027", props: [] }),
      sceneryNotes: status(500),
      notes: json({
        productionId: "2027",
        notes: [{ itemId: "pirate-sketch", text: "Chest set stage left", revision: 1 }],
      }),
    });

    const { wrapper } = await openOverview();

    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
    expect(notesUnder(wrapper, "Pirate Sketch")).toEqual([
      { label: "Props notes", text: "Chest set stage left" },
    ]);
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

describe("SFX and Wardrobe on the Production overview (production-sfx-wardrobe FR10, FR11)", () => {
  type Note = { itemId: string; text: string; revision: number };
  const notes = (list: Note[]) => json({ productionId: "2027", notes: list });
  const opening = anItem("Opening Number").id;
  const showWithFiles = () =>
    apiAnswers({
      order: json(show()),
      props: json({ productionId: "2027", props: [] }),
      sfx: json({ counts: { [opening]: 3 } }),
      wardrobe: json({ counts: { [opening]: 1 } }),
    });

  it("counts each item's SFX and Wardrobe files, 0 for none", async () => {
    showWithFiles();

    const { wrapper } = await openOverview();

    expect(shown(countIn(wrapper, "Opening Number", "sfx"))).toEqual({
      number: "3",
      word: "files",
    });
    expect(shown(countIn(wrapper, "Opening Number", "wardrobe"))).toEqual({
      number: "1",
      word: "file",
    });
    expect(shown(countIn(wrapper, "Finale", "sfx"))).toEqual({ number: "0", word: "files" });
    expect(shown(countIn(wrapper, "Finale", "wardrobe"))).toEqual({ number: "0", word: "files" });
  });

  it("reads each SFX and Wardrobe count to screen readers as one phrase", async () => {
    showWithFiles();

    const { wrapper } = await openOverview();

    const sfx = countIn(wrapper, "Opening Number", "sfx");
    expect(sfx?.get(".visually-hidden").text()).toBe("3 SFX files");
    expect(sfx?.get("[data-test=count-number]").attributes("aria-hidden")).toBe("true");
    expect(sfx?.get("[data-test=count-word]").attributes("aria-hidden")).toBe("true");
    const wardrobe = countIn(wrapper, "Opening Number", "wardrobe");
    expect(wardrobe?.get(".visually-hidden").text()).toBe("1 wardrobe file");
    expect(wardrobe?.get("[data-test=count-number]").attributes("aria-hidden")).toBe("true");
    expect(wardrobe?.get("[data-test=count-word]").attributes("aria-hidden")).toBe("true");
  });

  it("still shows the other counts when the SFX or Wardrobe counts fail, with no 0 for either", async () => {
    apiAnswers({
      order: json(show()),
      props: json({ productionId: "2027", props: [] }),
      sfx: status(500),
      wardrobe: status(500),
    });

    const { wrapper } = await openOverview();

    expect(shown(countIn(wrapper, "Opening Number", "scenery"))?.number).toBe("0");
    expect(wrapper.findAll("main [role=alert]").map((alert) => alert.text())).toEqual([
      "Couldn't load the SFX counts and the wardrobe counts.",
    ]);
    for (const department of ["sfx", "wardrobe"]) {
      const cells = wrapper.findAll(`[data-test=count][data-department=${department}]`);
      expect(cells.length).toBeGreaterThan(0);
      for (const cell of cells) expect(cell.text()).toBe("");
    }
  });

  /** The notes rows straight after the item's own row, each as its label and text. */
  const notesUnder = (wrapper: VueWrapper, title: string) => {
    const found: { label: string | null | undefined; text: string | undefined }[] = [];
    let row = rowFor(wrapper, title)?.element.nextElementSibling;
    while (row?.matches(".item-notes-row")) {
      const cell = row.querySelector("td");
      found.push({ label: cell?.getAttribute("data-label"), text: cell?.textContent?.trim() });
      row = row.nextElementSibling;
    }
    return found;
  };

  it("shows an item's scenery, props, SFX, Mic plot and Wardrobe notes in full, labelled, in that order", async () => {
    const note = (text: string) => [{ itemId: opening, text, revision: 1 }];
    apiAnswers({
      order: json(show()),
      props: json({ productionId: "2027", props: [] }),
      sceneryNotes: notes(note("Fly the cloud in after the blackout")),
      notes: notes(note("Chest set stage left")),
      sfxNotes: notes(note("Thunder on the second chorus")),
      micPlotNotes: notes(note("Mics 19–24 on for songs only")),
      wardrobeNotes: notes(note("Gold jackets for the chorus")),
    });

    const { wrapper } = await openOverview();

    expect(notesUnder(wrapper, "Opening Number")).toEqual([
      { label: "Scenery notes", text: "Fly the cloud in after the blackout" },
      { label: "Props notes", text: "Chest set stage left" },
      { label: "SFX notes", text: "Thunder on the second chorus" },
      { label: "Mic plot notes", text: "Mics 19–24 on for songs only" },
      { label: "Wardrobe notes", text: "Gold jackets for the chorus" },
    ]);
    const cell = wrapper.get("[data-test=wardrobe-notes] td");
    expect(cell.attributes("colspan")).toBe(
      String(wrapper.get("main table").findAll("thead th").length),
    );
  });

  it("shows nothing extra for an item with no notes, or cleared SFX, Mic plot and Wardrobe notes", async () => {
    apiAnswers({
      order: json(show()),
      props: json({ productionId: "2027", props: [] }),
      sfxNotes: notes([{ itemId: opening, text: "", revision: 2 }]),
      micPlotNotes: notes([{ itemId: opening, text: "", revision: 2 }]),
      wardrobeNotes: notes([{ itemId: opening, text: "", revision: 2 }]),
    });

    const { wrapper } = await openOverview();

    expect(notesUnder(wrapper, "Opening Number")).toEqual([]);
    expect(notesUnder(wrapper, "Finale")).toEqual([]);
  });

  it("still lists the items, and says so, when the SFX or Wardrobe notes can't be loaded", async () => {
    apiAnswers({
      order: json(show()),
      props: json({ productionId: "2027", props: [] }),
      sfxNotes: status(500),
      wardrobeNotes: notes([{ itemId: opening, text: "Gold jackets", revision: 1 }]),
    });

    const { wrapper } = await openOverview();

    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
    expect(notesUnder(wrapper, "Opening Number")).toEqual([
      { label: "Wardrobe notes", text: "Gold jackets" },
    ]);
    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the notes.");
  });
});

describe("The Mic plot on the Production overview (production-mics FR10, FR12, FR13)", () => {
  const mics = (count: number, from = 1) =>
    Array.from({ length: count }, (_, i) => ({ channel: from + i, castMemberId: from + i }));
  // Made-up items, with Link straight after the Opening Number and the Finale in the second half.
  const micShow = () =>
    aRunningOrder([anItem("Opening Number"), anItem("Link")], [anItem("Finale")]);
  const micPlotIs = (items: ItemMicPlot[], order = micShow()) =>
    apiAnswers({
      order: json(order),
      props: json({ productionId: "2027", props: [] }),
      micPlot: json({ productionId: "2027", items }),
    });
  // Beside the item's title, as the Items list's icon is.
  const clashIn = (wrapper: VueWrapper, title: string) =>
    rowFor(wrapper, title)?.find("td.title [data-test=clash]");

  it("counts each item's channels given out over the word mics, or mic for one, 0 for none", async () => {
    micPlotIs([
      { itemId: "opening-number", mics: mics(6) },
      { itemId: "link", mics: mics(1, 7) },
    ]);

    const { wrapper } = await openOverview();

    expect(shown(countIn(wrapper, "Opening Number", "mic-plot"))).toEqual({
      number: "6",
      word: "mics",
    });
    expect(shown(countIn(wrapper, "Link", "mic-plot"))).toEqual({ number: "1", word: "mic" });
    expect(shown(countIn(wrapper, "Finale", "mic-plot"))).toEqual({ number: "0", word: "mics" });
    expect(wrapper.get("main table").text()).not.toContain("Coming soon");
  });

  it("reads the count to screen readers as one phrase", async () => {
    micPlotIs([{ itemId: "opening-number", mics: mics(6) }]);

    const { wrapper } = await openOverview();

    const cell = countIn(wrapper, "Opening Number", "mic-plot");
    expect(cell?.get(".visually-hidden").text()).toBe("6 mics");
    expect(cell?.get("[data-test=count-number]").attributes("aria-hidden")).toBe("true");
    expect(cell?.get("[data-test=count-word]").attributes("aria-hidden")).toBe("true");
  });

  it("still shows the other counts when the mic plot can't be loaded, with no 0 for it", async () => {
    apiAnswers({
      order: json(micShow()),
      props: json({ productionId: "2027", props: [] }),
      micPlot: status(500),
    });

    const { wrapper } = await openOverview();

    expect(shown(countIn(wrapper, "Opening Number", "props"))?.number).toBe("0");
    expect(wrapper.get("main [role=alert]").text()).toBe("Couldn't load the mic plot counts.");
    const cells = wrapper.findAll("[data-test=count][data-department=mic-plot]");
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(cell.text()).toBe("");
  });

  describe("with a channel kept after a reorder put its item straight after one using it", () => {
    // Mic 1 is Alex Morgan's (1) in the Opening Number and was kept as Sam Patel's (2) in the
    // Finale, now straight after it.
    const reordered = () =>
      aRunningOrder([anItem("Opening Number"), anItem("Finale")], [anItem("Link")]);
    const kept = () =>
      micPlotIs(
        [
          { itemId: "opening-number", mics: [{ channel: 1, castMemberId: 1 }] },
          { itemId: "finale", mics: [{ channel: 1, castMemberId: 2 }] },
        ],
        reordered(),
      );

    it("still counts the kept channel, with an Error icon beside the item's title", async () => {
      kept();

      const { wrapper } = await openOverview();

      expect(shown(countIn(wrapper, "Finale", "mic-plot"))).toEqual({ number: "1", word: "mic" });
      expect(clashIn(wrapper, "Finale")?.attributes("data-severity")).toBe("error");
    });

    it("says how many errors, and on which mics, in words a screen reader hears too", async () => {
      kept();

      const { wrapper } = await openOverview();

      const clash = clashIn(wrapper, "Finale");
      expect(clash?.get("[data-test=clash-description]").text()).toBe("1 error: Mic 1");
      expect(clash?.get("[data-test=clash-icon]").attributes("aria-label")).toBe("1 error: Mic 1");
      expect(clash?.get("[data-test=clash-icon]").attributes("tabindex")).toBe("0");
    });

    it("names every kept channel in the item", async () => {
      micPlotIs(
        [
          { itemId: "opening-number", mics: [...mics(1), { channel: 3, castMemberId: 3 }] },
          { itemId: "finale", mics: [...mics(1, 2), { channel: 3, castMemberId: 1 }] },
        ],
        reordered(),
      );

      const { wrapper } = await openOverview();

      expect(clashIn(wrapper, "Finale")?.get("[data-test=clash-description]").text()).toBe(
        "1 error: Mic 3",
      );
    });

    it("shows no icon in the item before, or in items without one", async () => {
      kept();

      const { wrapper } = await openOverview();

      expect(clashIn(wrapper, "Opening Number")?.exists()).toBe(false);
      expect(clashIn(wrapper, "Link")?.exists()).toBe(false);
    });
  });

  it("counts two kept channels as 2 errors", async () => {
    micPlotIs([
      { itemId: "opening-number", mics: mics(2) },
      {
        itemId: "link",
        mics: [
          { channel: 1, castMemberId: 5 },
          { channel: 2, castMemberId: 6 },
        ],
      },
    ]);

    const { wrapper } = await openOverview();

    expect(clashIn(wrapper, "Link")?.get("[data-test=clash-description]").text()).toBe(
      "2 errors: Mic 1, Mic 2",
    );
  });
});
