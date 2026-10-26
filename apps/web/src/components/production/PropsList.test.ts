import type { Prop, RunningOrder } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import { createAppRouter } from "@/router/index.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { PROPS_PATH } from "@/utils/props.ts";
import { PROPS_NOTES_PATH } from "@/utils/props-notes.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";
import { RUNNING_ORDER_PATH } from "@/utils/running-order.ts";
import PropsList from "./PropsList.vue";

enableAutoUnmount(afterEach);
// As on pnpm dev: everyone acts as an admin, unless a test signs someone in.
beforeEach(useLocalSignIn);
afterEach(() => {
  vi.unstubAllGlobals();
  useLocalSignIn();
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
      return new Response(null, { status: 204 });
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

async function openPropsList() {
  const router = createAppRouter(createMemoryHistory());
  const wrapper = mount(PropsList, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

const titlesIn = (wrapper: VueWrapper, halfName: string) =>
  wrapper
    .findAll("section")
    .find((section) => section.find("h2").text() === halfName)
    ?.findAll("[data-test=title]")
    .map((title) => title.text());

const rowFor = (wrapper: VueWrapper, title: string) =>
  wrapper.findAll("[data-test=item]").find((row) => row.get("[data-test=title]").text() === title);

describe("Props list", () => {
  it("lists each half under its name, with its items in running order", async () => {
    savedShowIs(show());

    const { wrapper } = await openPropsList();

    expect(wrapper.findAll("h2").map((h2) => h2.text())).toEqual(["First half", "Second half"]);
    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
    expect(titlesIn(wrapper, "Second half")?.at(-1)).toBe("Finale");
  });

  it("heads its columns Props, #, Item and Props count, with no minutes", async () => {
    savedShowIs(show());

    const { wrapper } = await openPropsList();

    const headings = wrapper.get("table").findAll("thead th");
    expect(headings.map((th) => th.text())).toEqual(["Props", "#", "Item", "Props count"]);
    expect(wrapper.find("[data-test=minutes]").exists()).toBe(false);
  });

  it("shows each item's number and title", async () => {
    savedShowIs(show());

    const { wrapper } = await openPropsList();

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

    const { wrapper } = await openPropsList();

    const announcement = rowFor(wrapper, "Interval Announcement");
    expect(announcement?.classes()).toContain("not-printed");
    expect(announcement?.get("[data-test=number]").text()).toBe("Not in printed programme");
    expect(announcement?.get("[data-test=number]").text()).not.toMatch(/\d/);
    expect(rowFor(wrapper, "Pirate Sketch")?.get("[data-test=number]").text()).toBe("2");
  });

  it("shows each item's props count with a label", async () => {
    savedShowIs(show(), [
      aProp(1, "Pirate Sketch"),
      aProp(2, "Pirate Sketch"),
      aProp(3, "Opening Number"),
      aProp(4, "Pirate Sketch"),
    ]);

    const { wrapper } = await openPropsList();

    const countOf = (title: string) => rowFor(wrapper, title)?.get("[data-test=count]").text();
    expect(countOf("Pirate Sketch")).toBe("3 props");
    expect(countOf("Opening Number")).toBe("1 prop");
    expect(countOf("Finale")).toBe("0 props");
  });

  describe("with Stage", () => {
    beforeEach(() => signInAs(["stage"], "pat"));

    it("has a pencil button in each row, named for its item, that opens the item's props", async () => {
      savedShowIs(show());
      const { wrapper, router } = await openPropsList();

      const button = rowFor(wrapper, "Pirate Sketch")?.get("[data-test=open-props]");
      expect(button?.attributes("aria-label")).toBe("Edit props for Pirate Sketch");
      expect(button?.find("svg.fa-pen").exists()).toBe(true);
      expect(
        rowFor(wrapper, "Finale")?.get("[data-test=open-props]").attributes("aria-label"),
      ).toBe("Edit props for Finale");

      await button?.trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("props-item");
      expect(router.currentRoute.value.params.itemId).toBe("pirate-sketch");
    });
  });

  it("gives an admin the pencil button", async () => {
    await signInAs(["admin"], "alex");
    savedShowIs(show());

    const { wrapper } = await openPropsList();

    expect(
      rowFor(wrapper, "Pirate Sketch")?.get("[data-test=open-props]").attributes("aria-label"),
    ).toBe("Edit props for Pirate Sketch");
  });

  describe("without Stage", () => {
    beforeEach(() => signInAs(["casting"], "sam"));

    it("has a view button in each row, named for its item, that opens the item's props", async () => {
      savedShowIs(show());
      const { wrapper, router } = await openPropsList();

      const button = rowFor(wrapper, "Pirate Sketch")?.get("[data-test=open-props]");
      expect(button?.attributes("aria-label")).toBe("View props for Pirate Sketch");

      await button?.trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("props-item");
      expect(router.currentRoute.value.params.itemId).toBe("pirate-sketch");
    });
  });

  it("says there's no running order yet, linking to the Running order page", async () => {
    apiAnswers({ order: status(404), props: json({ productionId: "2027", props: [] }) });

    const { wrapper } = await openPropsList();

    expect(wrapper.text()).toContain("There's no saved running order yet.");
    expect(wrapper.get("a[href='/running-order']").text()).toBe("Running order page");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("says it couldn't load the items, not that there's no running order, when the load fails", async () => {
    apiAnswers({ order: status(500), props: json({ productionId: "2027", props: [] }) });

    const { wrapper } = await openPropsList();

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the items.");
    expect(wrapper.text()).not.toContain("no saved running order");
  });

  it("still shows the items when the props can't be loaded, with no count reading 0", async () => {
    apiAnswers({ order: json(show()), props: status(500) });

    const { wrapper } = await openPropsList();

    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the props counts.");
    const counts = wrapper.findAll("[data-test=count]").map((cell) => cell.text());
    expect(counts.length).toBeGreaterThan(0);
    for (const count of counts) expect(count).not.toMatch(/\d/);
  });
});

describe("Props notes on the Props list", () => {
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

    const { wrapper } = await openPropsList();

    const notes = notesFor(wrapper, "Pirate Sketch");
    expect(notes?.textContent?.trim()).toBe("Chest set stage left before the blackout");
    expect(notes?.querySelector("td")?.getAttribute("colspan")).toBe("4");
    expect(notes?.querySelector("td")?.getAttribute("data-label")).toBe("Props notes");
  });

  it("shows nothing extra for an item with no props notes, or cleared ones", async () => {
    withNotes([{ itemId: "opening-number", text: "", revision: 2 }]);

    const { wrapper } = await openPropsList();

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

    const { wrapper } = await openPropsList();

    expect(titlesIn(wrapper, "First half")).toEqual(["Opening Number", "Pirate Sketch"]);
    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the notes.");
  });
});
