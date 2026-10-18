import {
  type ItemNoteList,
  type RoleList,
  type RunningOrder,
  type RunningOrderItem,
  SaveRunningOrderRequest,
} from "@app/shared";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signInAs } from "../sign-in.fixture.ts";
import { useLocalSignIn } from "../sign-in.ts";
import RunningOrderPage from "./RunningOrderPage.vue";

// SortableJS can't drag in happy-dom, so stand in for it and fire its drop event directly.
interface DropEvent {
  item: HTMLElement;
  from: HTMLElement;
  to: HTMLElement;
  oldIndex: number;
  newIndex: number;
}
interface FakeSortable {
  el: HTMLElement;
  options: {
    group?: string;
    handle?: string;
    draggable?: string;
    onEnd?: (event: DropEvent) => void;
  };
  option: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}
const sortables = vi.hoisted((): FakeSortable[] => []);
vi.mock("sortablejs", () => ({
  default: {
    create: (el: HTMLElement, options: FakeSortable["options"]) => {
      const sortable = { el, options, option: vi.fn(), destroy: vi.fn() };
      sortables.push(sortable);
      return sortable;
    },
    get: (el: HTMLElement) => sortables.findLast((sortable) => sortable.el === el),
  },
}));

// Pages left mounted would keep their window listeners between tests.
enableAutoUnmount(afterEach);

// Made-up data only: tests never use the real programme (CLAUDE.md safeguarding).
const anItem = (title: string, details: Partial<RunningOrderItem> = {}): RunningOrderItem => ({
  id: `itm_${title.toLowerCase().replaceAll(" ", "-")}`,
  title,
  cast: "Full Senior Gang",
  stage: ["full"],
  leads: "",
  comments: "",
  minutes: 5,
  printed: true,
  ...details,
});

const aRunningOrder = (
  first: RunningOrderItem[],
  second: RunningOrderItem[] = [],
  version = 6,
): RunningOrder => ({
  productionId: "2027",
  title: "Gang Show 2027",
  version,
  savedAt: "2026-10-04T00:00:00.000Z",
  startTime: "19:15",
  intervalMinutes: 20,
  halves: [
    { id: "first-half", name: "First half", items: first },
    { id: "second-half", name: "Second half", items: second },
  ],
});

type SentItems = SaveRunningOrderRequest["change"]["halves"][number]["items"];
let serverIds = 0;
/** The items as the server saves them: an added item, sent without an id, gets one. */
const savedItems = (items: SentItems): RunningOrderItem[] =>
  items.map((item) => ("id" in item ? item : { id: `server-${++serverIds}`, ...item }));

function serve(order: RunningOrder) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(order)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openPage() {
  const wrapper = mount(RunningOrderPage, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

const half = (wrapper: Awaited<ReturnType<typeof openPage>>, name: string) =>
  wrapper.get(`section[aria-labelledby="${name}"]`);
const titlesIn = (section: ReturnType<typeof half>) =>
  section.findAll("tbody tr[data-item-id]").map((row) => row.get("[data-test=title]").text());
const rowFor = (wrapper: Awaited<ReturnType<typeof openPage>>, title: string) => {
  // Rows being edited show a form instead of their cells, so skip them.
  const row = wrapper
    .findAll("tbody tr[data-item-id]")
    .find(
      (r) => r.find("[data-test=title]").exists() && r.get("[data-test=title]").text() === title,
    );
  if (!row) throw new Error(`no row for ${title}`);
  return row;
};

describe("Running order page", () => {
  // As on pnpm dev: everyone acts as an admin, unless a test signs someone in.
  beforeEach(useLocalSignIn);
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("shows both halves with their items in order", async () => {
    serve(aRunningOrder([anItem("Curtain Up"), anItem("Pirate Panic")], [anItem("Big Finish")]));

    const wrapper = await openPage();

    expect(half(wrapper, "first-half").get("h2").text()).toBe("First half");
    expect(titlesIn(half(wrapper, "first-half"))).toEqual(["Curtain Up", "Pirate Panic"]);
    expect(half(wrapper, "second-half").get("h2").text()).toBe("Second half");
    expect(titlesIn(half(wrapper, "second-half"))).toEqual(["Big Finish"]);
  });

  it("fetches the 2027 running order", async () => {
    const fetchMock = serve(aRunningOrder([anItem("Curtain Up")]));

    await openPage();

    expect(fetchMock).toHaveBeenCalledWith("/api/productions/2027/running-order");
  });

  it("shows each item's details", async () => {
    serve(
      aRunningOrder([
        anItem("Pirate Panic", {
          cast: "Cubs + Beavers",
          stage: ["apron", "full", "apron"],
          leads: "Sam / Alex",
          comments: "Performed to track",
          minutes: 18,
        }),
      ]),
    );

    const wrapper = await openPage();

    const headers = wrapper.findAll("thead th").map((th) => th.text());
    const cells = rowFor(wrapper, "Pirate Panic").findAll("td");
    const cellUnder = (header: string) => cells[headers.indexOf(header)]?.text();
    expect(cellUnder("Cast")).toBe("Cubs + Beavers");
    expect(cellUnder("Stage")).toBe("Apron / Full / Apron");
    expect(cellUnder("Leads")).toBe("Sam / Alex");
    expect(cellUnder("Comments")).toBe("Performed to track");
    expect(cellUnder("Mins")).toBe("18");
  });

  it("labels every cell with its column, for the stacked layout on narrow screens", async () => {
    serve(aRunningOrder([anItem("Curtain Up")]));

    const wrapper = await openPage();

    const headers = half(wrapper, "first-half")
      .findAll("thead th")
      .map((th) => th.text());
    const labels = rowFor(wrapper, "Curtain Up")
      .findAll("td")
      .map((cell) => cell.attributes("data-label"));
    expect(labels).toEqual(headers);
  });

  it("shows the current version as a draft number", async () => {
    serve(aRunningOrder([anItem("Curtain Up")], [], 6));

    const wrapper = await openPage();

    expect(wrapper.text()).toContain("Draft 6");
  });

  it("numbers only printed items and marks the rest", async () => {
    serve(
      aRunningOrder([
        anItem("Curtain Up"),
        anItem("Producers' Call", { printed: false }),
        anItem("Pirate Panic"),
      ]),
    );

    const wrapper = await openPage();

    const number = (title: string) => rowFor(wrapper, title).get("[data-test=number]").text();
    expect(number("Curtain Up")).toBe("1");
    expect(number("Pirate Panic")).toBe("2");
    expect(number("Producers' Call")).toBe("Not in printed programme");
  });

  it("restarts numbering in the second half", async () => {
    serve(aRunningOrder([anItem("Curtain Up")], [anItem("Big Finish")]));

    const wrapper = await openPage();

    expect(rowFor(wrapper, "Big Finish").get("[data-test=number]").text()).toBe("1");
  });

  it("says there's no running order yet when none is saved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const wrapper = await openPage();

    expect(wrapper.text()).toContain("No running order yet");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("says the running order couldn't be loaded when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const wrapper = await openPage();

    expect(wrapper.text()).toContain("Couldn't load the running order");
  });

  it("treats an off-contract response as a load failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ x: 1 }))));

    const wrapper = await openPage();

    expect(wrapper.text()).toContain("Couldn't load the running order");
  });

  describe("running clock", () => {
    const startsAt = (wrapper: Awaited<ReturnType<typeof openPage>>, title: string) =>
      rowFor(wrapper, title).get("[data-test=starts]").text();

    it("shows when each item starts", async () => {
      serve(
        aRunningOrder([
          anItem("Curtain Up", { minutes: 5 }),
          anItem("Pirate Panic", { minutes: 18 }),
        ]),
      );

      const wrapper = await openPage();

      expect(startsAt(wrapper, "Curtain Up")).toBe("7:15 pm");
      expect(startsAt(wrapper, "Pirate Panic")).toBe("7:20 pm");
    });

    it("shows each half's total", async () => {
      serve(
        aRunningOrder(
          [anItem("Curtain Up", { minutes: 60 }), anItem("Pirate Panic", { minutes: 7 })],
          [anItem("Big Finish", { minutes: 62 })],
        ),
      );

      const wrapper = await openPage();

      expect(half(wrapper, "first-half").get("[data-test=total]").text()).toBe("67 mins");
      expect(half(wrapper, "second-half").get("[data-test=total]").text()).toBe("62 mins");
    });

    it("places the interval after the first half", async () => {
      serve(
        aRunningOrder(
          [anItem("Curtain Up", { minutes: 60 }), anItem("Pirate Panic", { minutes: 7 })],
          [anItem("Big Finish", { minutes: 62 })],
        ),
      );

      const wrapper = await openPage();

      expect(wrapper.get("[data-test=interval]").text()).toBe("Interval 8:22 pm – 8:42 pm");
      expect(startsAt(wrapper, "Big Finish")).toBe("8:42 pm");
    });

    it("shows the projected finish", async () => {
      serve(
        aRunningOrder(
          [anItem("Curtain Up", { minutes: 67 })],
          [anItem("Big Finish", { minutes: 62 })],
        ),
      );

      const wrapper = await openPage();

      expect(wrapper.get("[data-test=finish]").text()).toBe("Projected finish 9:44 pm");
    });

    it("flags untimed items and counts them as zero", async () => {
      serve(
        aRunningOrder(
          [anItem("Curtain Up", { minutes: 5 })],
          [anItem("Big Finish", { minutes: null }), anItem("Encore", { minutes: 3 })],
        ),
      );

      const wrapper = await openPage();

      expect(rowFor(wrapper, "Big Finish").get("[data-test=minutes]").text()).toBe("Untimed");
      expect(startsAt(wrapper, "Encore")).toBe(startsAt(wrapper, "Big Finish"));
    });

    it("counts items not in the printed programme towards the time", async () => {
      serve(
        aRunningOrder([
          anItem("Curtain Up", { minutes: 5 }),
          anItem("Producers' Call", { minutes: 4, printed: false }),
        ]),
      );

      const wrapper = await openPage();

      expect(half(wrapper, "first-half").get("[data-test=total]").text()).toBe("9 mins");
    });
  });

  describe("reordering with move buttons", () => {
    // A stand-in for the API: serves the latest version and applies saved drafts to it.
    function fakeApi(initial: RunningOrder) {
      let latest = initial;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          if (init?.method !== "POST") return new Response(JSON.stringify(latest));
          expect(url).toBe("/api/productions/2027/running-order/versions");
          const { baseVersion, change } = SaveRunningOrderRequest.parse(
            JSON.parse(String(init.body)),
          );
          if (baseVersion !== latest.version) {
            return new Response(JSON.stringify(latest), { status: 409 });
          }
          latest = {
            ...latest,
            version: latest.version + 1,
            halves: [
              { ...latest.halves[0], items: savedItems(change.halves[0].items) },
              { ...latest.halves[1], items: savedItems(change.halves[1].items) },
            ],
          };
          return new Response(JSON.stringify(latest), { status: 201 });
        }),
      );
      return { someoneElseSaves: (order: RunningOrder) => (latest = order) };
    }

    const threeItems = () =>
      aRunningOrder(
        [anItem("Curtain Up"), anItem("Pirate Panic"), anItem("Dance One")],
        [anItem("Big Finish")],
      );
    const moveButton = (wrapper: Awaited<ReturnType<typeof openPage>>, label: string) =>
      wrapper.get(`button[aria-label="${label}"]`);
    async function press(wrapper: Awaited<ReturnType<typeof openPage>>, label: string) {
      await moveButton(wrapper, label).trigger("click");
      await flushPromises();
    }

    const firstHalfTitles = (wrapper: Awaited<ReturnType<typeof openPage>>) =>
      titlesIn(half(wrapper, "first-half"));
    const saveButton = (wrapper: Awaited<ReturnType<typeof openPage>>) =>
      wrapper.get("button[data-test=save]");
    const resetButton = (wrapper: Awaited<ReturnType<typeof openPage>>) =>
      wrapper.get("button[data-test=reset]");
    async function click(button: ReturnType<typeof saveButton>) {
      await button.trigger("click");
      await flushPromises();
    }
    const posts = () =>
      vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST").length;

    it("moves an item down as an unsaved change, renumbering it", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      await press(wrapper, "Move Curtain Up down");

      expect(firstHalfTitles(wrapper)).toEqual(["Pirate Panic", "Curtain Up", "Dance One"]);
      expect(rowFor(wrapper, "Pirate Panic").get("[data-test=number]").text()).toBe("1");
      expect(rowFor(wrapper, "Curtain Up").get("[data-test=number]").text()).toBe("2");
      expect(wrapper.text()).toContain("Draft 6");
      expect(wrapper.find("[data-test=unsaved]").text()).toBe("Unsaved changes");
      expect(posts()).toBe(0);
    });

    it("moves an item up", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      await press(wrapper, "Move Dance One up");

      expect(firstHalfTitles(wrapper)).toEqual(["Curtain Up", "Dance One", "Pirate Panic"]);
    });

    it("moves the last item of the first half to the start of the second half", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      await press(wrapper, "Move Dance One to second half");

      expect(firstHalfTitles(wrapper)).toEqual(["Curtain Up", "Pirate Panic"]);
      expect(titlesIn(half(wrapper, "second-half"))).toEqual(["Dance One", "Big Finish"]);
    });

    it("moves an item from the second half to the end of the first half", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      await press(wrapper, "Move Big Finish to first half");

      expect(firstHalfTitles(wrapper)).toEqual([
        "Curtain Up",
        "Pirate Panic",
        "Dance One",
        "Big Finish",
      ]);
      expect(titlesIn(half(wrapper, "second-half"))).toEqual([]);
    });

    it("shows compact icon move buttons with full names and tooltips", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      const row = rowFor(wrapper, "Curtain Up");
      const buttons = row.findAll("button[data-move]");
      expect(
        buttons.map((b) => [
          b.get("svg[aria-hidden=true]").attributes("data-icon"),
          b.attributes("aria-label"),
          b.attributes("data-tooltip"),
        ]),
      ).toEqual([
        ["arrow-up", "Move Curtain Up up", "Move up"],
        ["arrow-down", "Move Curtain Up down", "Move down"],
        ["arrow-right-arrow-left", "Move Curtain Up to second half", "Move to second half"],
      ]);
      const handle = row.get(".drag-handle");
      expect(handle.attributes("data-tooltip")).toBe("Drag to reorder");
      expect(handle.get("svg[aria-hidden=true]").attributes("data-icon")).toBe("grip-vertical");
    });

    it("tells people how to fill an empty half without relying on a symbol", async () => {
      fakeApi(aRunningOrder([anItem("Curtain Up")], []));
      const wrapper = await openPage();

      expect(half(wrapper, "second-half").get("tbody").text()).toBe(
        "No items. Drag one here, use “Move to second half” on an item, or use Add item below.",
      );
    });

    it("doesn't offer moves that would leave the half", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      expect(moveButton(wrapper, "Move Curtain Up up").attributes("disabled")).toBeDefined();
      expect(moveButton(wrapper, "Move Big Finish down").attributes("disabled")).toBeDefined();
      expect(moveButton(wrapper, "Move Curtain Up down").attributes("disabled")).toBeUndefined();
    });

    it("saves unsaved changes as the next draft", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();
      await press(wrapper, "Move Curtain Up down");

      expect(saveButton(wrapper).text()).toBe("Save as Draft 7");
      await click(saveButton(wrapper));

      expect(wrapper.text()).toContain("Draft 7");
      expect(wrapper.find("[data-test=unsaved]").exists()).toBe(false);
      expect(firstHalfTitles(wrapper)).toEqual(["Pirate Panic", "Curtain Up", "Dance One"]);
      expect(posts()).toBe(1);
    });

    it("resets unsaved changes back to the saved draft", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();
      await press(wrapper, "Move Curtain Up down");
      await press(wrapper, "Move Big Finish to first half");

      await click(resetButton(wrapper));

      expect(firstHalfTitles(wrapper)).toEqual(["Curtain Up", "Pirate Panic", "Dance One"]);
      expect(titlesIn(half(wrapper, "second-half"))).toEqual(["Big Finish"]);
      expect(wrapper.find("[data-test=unsaved]").exists()).toBe(false);
      expect(posts()).toBe(0);
    });

    it("offers Save and Reset only when there's something to save", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();
      const unavailable = () => [
        saveButton(wrapper).attributes("disabled") !== undefined,
        resetButton(wrapper).attributes("disabled") !== undefined,
      ];
      expect(unavailable()).toEqual([true, true]);

      await press(wrapper, "Move Curtain Up down");
      expect(unavailable()).toEqual([false, false]);

      await press(wrapper, "Move Curtain Up up");
      expect(unavailable()).toEqual([true, true]);
    });

    it("shows the saved draft after a reload", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();
      await press(wrapper, "Move Curtain Up down");
      await click(saveButton(wrapper));
      wrapper.unmount();

      const reloaded = await openPage();

      expect(firstHalfTitles(reloaded)).toEqual(["Pirate Panic", "Curtain Up", "Dance One"]);
      expect(reloaded.text()).toContain("Draft 7");
    });

    it("shows the latest draft instead of overwriting someone else's", async () => {
      const api = fakeApi(threeItems());
      const wrapper = await openPage();
      await press(wrapper, "Move Curtain Up down");
      api.someoneElseSaves(
        aRunningOrder(
          [anItem("Dance One"), anItem("Curtain Up"), anItem("Pirate Panic")],
          [anItem("Big Finish")],
          7,
        ),
      );

      await click(saveButton(wrapper));

      expect(wrapper.text()).toContain(
        "Someone else saved a newer draft. Showing the latest (Draft 7). Your unsaved changes were discarded.",
      );
      expect(firstHalfTitles(wrapper)).toEqual(["Dance One", "Curtain Up", "Pirate Panic"]);
      expect(wrapper.find("[data-test=unsaved]").exists()).toBe(false);
    });

    it("holds off Save, Reset and moves while a save is in progress", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();
      await press(wrapper, "Move Curtain Up down");
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

      await saveButton(wrapper).trigger("click");

      expect(saveButton(wrapper).attributes("disabled")).toBeDefined();
      expect(resetButton(wrapper).attributes("disabled")).toBeDefined();
      expect(moveButton(wrapper, "Move Dance One up").attributes("disabled")).toBeDefined();
    });

    describe("for someone signed in", () => {
      afterEach(useLocalSignIn);

      it("shows the running order to everyone, but saves only for admins, saying why", async () => {
        await signInAs([]);
        fakeApi(threeItems());
        const wrapper = await openPage();
        await press(wrapper, "Move Curtain Up down");

        expect(firstHalfTitles(wrapper)).toEqual(["Pirate Panic", "Curtain Up", "Dance One"]);
        expect(saveButton(wrapper).attributes("disabled")).toBeDefined();
        expect(wrapper.get("[data-test=admin-only]").text()).toBe(
          "Only admins can save the running order, or add and remove items",
        );
      });

      it("lets an admin save as before", async () => {
        await signInAs(["admin"]);
        fakeApi(threeItems());
        const wrapper = await openPage();
        await press(wrapper, "Move Curtain Up down");

        expect(wrapper.find("[data-test=admin-only]").exists()).toBe(false);
        await click(saveButton(wrapper));

        expect(posts()).toBe(1);
        expect(wrapper.text()).toContain("Draft 7");
      });

      // Such as when their admin role was removed after they signed in.
      it("explains a refusal for not being an admin, keeping the changes", async () => {
        await signInAs(["admin"]);
        fakeApi(threeItems());
        const wrapper = await openPage();
        await press(wrapper, "Move Curtain Up down");
        vi.stubGlobal(
          "fetch",
          vi.fn(async () => new Response(null, { status: 403 })),
        );

        await click(saveButton(wrapper));

        expect(wrapper.get(".notice").text()).toBe("Only admins can change the running order.");
        expect(firstHalfTitles(wrapper)).toEqual(["Pirate Panic", "Curtain Up", "Dance One"]);
        expect(wrapper.find("[data-test=unsaved]").exists()).toBe(true);
        expect(wrapper.text()).toContain("Draft 6");
      });
    });

    it("keeps unsaved changes and says so when the save fails", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();
      await press(wrapper, "Move Curtain Up down");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      await click(saveButton(wrapper));

      expect(wrapper.text()).toContain("Couldn't save the draft. Your changes are still here.");
      expect(firstHalfTitles(wrapper)).toEqual(["Pirate Panic", "Curtain Up", "Dance One"]);
      expect(wrapper.find("[data-test=unsaved]").text()).toBe("Unsaved changes");
    });

    it("announces the move and keeps focus on the moved item", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      await press(wrapper, "Move Curtain Up down");

      expect(wrapper.get("[role=status]").text()).toBe(
        "Curtain Up moved to position 2. Not saved yet.",
      );
      const focused = document.activeElement;
      expect(focused?.tagName).toBe("BUTTON");
      expect(rowFor(wrapper, "Curtain Up").element.contains(focused)).toBe(true);
    });

    it("announces a move into the other half with its new position", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      await press(wrapper, "Move Dance One to second half");

      expect(wrapper.get("[role=status]").text()).toBe(
        "Dance One moved to the second half, position 1. Not saved yet.",
      );
    });

    it("asks the browser to confirm closing or refreshing with unsaved changes", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();
      const leave = () => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      };
      expect(leave()).toBe(false);

      await press(wrapper, "Move Curtain Up down");

      expect(leave()).toBe(true);
    });
  });

  describe("reordering by drag and drop", () => {
    beforeEach(() => {
      sortables.length = 0;
    });

    const tbodyOf = (wrapper: Awaited<ReturnType<typeof openPage>>, halfId: string) =>
      wrapper.get(`section[aria-labelledby="${halfId}"] tbody`).element;

    // Moves the row in the DOM as SortableJS would, then reports the drop.
    async function drag(
      wrapper: Awaited<ReturnType<typeof openPage>>,
      title: string,
      toHalfId: string,
      newIndex: number,
    ) {
      const item = rowFor(wrapper, title).element;
      const from = item.parentElement;
      const to = tbodyOf(wrapper, toHalfId);
      if (!(item instanceof HTMLElement && from && to instanceof HTMLElement)) {
        throw new Error("expected a row inside a tbody");
      }
      const oldIndex = [...from.children].indexOf(item);
      const sortable = sortables.findLast((s) => s.el === from);
      if (!sortable?.options.onEnd) throw new Error("no sortable list for this half");
      to.insertBefore(item, [...to.children].filter((row) => row !== item)[newIndex] ?? null);
      sortable.options.onEnd({ item, from, to, oldIndex, newIndex });
      await flushPromises();
    }

    const threeItems = () =>
      aRunningOrder(
        [anItem("Curtain Up"), anItem("Pirate Panic"), anItem("Dance One")],
        [anItem("Big Finish")],
      );

    it("makes a drag within a half an unsaved change", async () => {
      serve(threeItems());
      const wrapper = await openPage();

      await drag(wrapper, "Dance One", "first-half", 0);

      expect(titlesIn(half(wrapper, "first-half"))).toEqual([
        "Dance One",
        "Curtain Up",
        "Pirate Panic",
      ]);
      expect(wrapper.find("[data-test=unsaved]").exists()).toBe(true);
      expect(wrapper.get("button[data-test=save]").text()).toBe("Save as Draft 7");
      expect(wrapper.get("[role=status]").text()).toBe(
        "Dance One moved to position 1. Not saved yet.",
      );
    });

    it("drags an item across the interval", async () => {
      serve(threeItems());
      const wrapper = await openPage();

      await drag(wrapper, "Big Finish", "first-half", 1);

      expect(titlesIn(half(wrapper, "first-half"))).toEqual([
        "Curtain Up",
        "Big Finish",
        "Pirate Panic",
        "Dance One",
      ]);
      expect(titlesIn(half(wrapper, "second-half"))).toEqual([]);
    });

    it("changes nothing when an item is dropped where it started", async () => {
      serve(threeItems());
      const wrapper = await openPage();

      await drag(wrapper, "Pirate Panic", "first-half", 1);

      expect(titlesIn(half(wrapper, "first-half"))).toEqual([
        "Curtain Up",
        "Pirate Panic",
        "Dance One",
      ]);
      expect(wrapper.find("[data-test=unsaved]").exists()).toBe(false);
      expect(wrapper.get("[role=status]").text()).toBe("");
    });

    it("keeps an emptied half as a place to drop items back into", async () => {
      serve(threeItems());
      const wrapper = await openPage();
      await drag(wrapper, "Big Finish", "first-half", 3);

      expect(half(wrapper, "second-half").get("tbody").text()).toContain("No items");
      expect(sortables.every((s) => s.options.draggable === "[data-item-id]")).toBe(true);

      await drag(wrapper, "Curtain Up", "second-half", 0);

      expect(titlesIn(half(wrapper, "second-half"))).toEqual(["Curtain Up"]);
    });

    it("gives each row a labelled drag handle alongside the move buttons", async () => {
      serve(threeItems());
      const wrapper = await openPage();

      const row = rowFor(wrapper, "Pirate Panic");
      expect(row.get(".drag-handle").attributes("aria-label")).toBe("Drag Pirate Panic");
      expect(row.find("button[aria-label='Move Pirate Panic up']").exists()).toBe(true);
      const halves = sortables.filter((s) => s.el.isConnected);
      expect(halves).toHaveLength(2);
      expect(halves.map((s) => [s.options.group, s.options.handle])).toEqual([
        ["running-order", ".drag-handle"],
        ["running-order", ".drag-handle"],
      ]);
    });

    it("saves and resets dragged changes like moves", async () => {
      serve(threeItems());
      const wrapper = await openPage();
      await drag(wrapper, "Dance One", "first-half", 0);

      await wrapper.get("button[data-test=reset]").trigger("click");
      await flushPromises();
      expect(titlesIn(half(wrapper, "first-half"))).toEqual([
        "Curtain Up",
        "Pirate Panic",
        "Dance One",
      ]);

      await drag(wrapper, "Dance One", "first-half", 0);
      const saved = aRunningOrder(
        [anItem("Dance One"), anItem("Curtain Up"), anItem("Pirate Panic")],
        [anItem("Big Finish")],
        7,
      );
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(saved), { status: 201 }));
      vi.stubGlobal("fetch", fetchMock);
      await wrapper.get("button[data-test=save]").trigger("click");
      await flushPromises();

      const sent = SaveRunningOrderRequest.parse(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body));
      expect(sent.change.halves[0].items.map((item) => ("id" in item ? item.id : ""))).toEqual([
        "itm_dance-one",
        "itm_curtain-up",
        "itm_pirate-panic",
      ]);
      expect(wrapper.text()).toContain("Draft 7");
      expect(wrapper.find("[data-test=unsaved]").exists()).toBe(false);
    });

    it("stops dragging while a save is in progress", async () => {
      serve(threeItems());
      const wrapper = await openPage();
      await drag(wrapper, "Dance One", "first-half", 0);
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

      await wrapper.get("button[data-test=save]").trigger("click");
      await flushPromises();

      await drag(wrapper, "Curtain Up", "second-half", 0);
      expect(titlesIn(half(wrapper, "second-half"))).toEqual(["Big Finish"]);

      const live = sortables.filter((s) => s.el.isConnected);
      expect(live).toHaveLength(2);
      expect(live.every((s) => s.option.mock.calls.some(([k, v]) => k === "disabled" && v))).toBe(
        true,
      );
    });
  });

  describe("editing an item's details", () => {
    let saves: SaveRunningOrderRequest[] = [];
    function api(initial: RunningOrder) {
      let latest = initial;
      saves = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init?: RequestInit) => {
          if (init?.method !== "POST") return new Response(JSON.stringify(latest));
          const request = SaveRunningOrderRequest.parse(JSON.parse(String(init.body)));
          saves.push(request);
          const [first, second] = request.change.halves;
          latest = {
            ...latest,
            version: latest.version + 1,
            halves: [
              { ...latest.halves[0], items: savedItems(first.items) },
              { ...latest.halves[1], items: savedItems(second.items) },
            ],
          };
          return new Response(JSON.stringify(latest), { status: 201 });
        }),
      );
    }

    const order = () =>
      aRunningOrder(
        [
          anItem("Curtain Up"),
          anItem("Pirate Panic", {
            cast: "Cubs + Beavers",
            stage: ["apron", "full", "apron"],
            leads: "Sam / Alex",
            comments: "Performed to track",
            minutes: 18,
          }),
          anItem("Dance One"),
        ],
        [anItem("Big Finish")],
      );

    type Page = Awaited<ReturnType<typeof openPage>>;
    async function openEditor(wrapper: Page, title: string) {
      await wrapper.get(`button[aria-label="Edit ${title}"]`).trigger("click");
      await flushPromises();
      return wrapper.get("form[data-test=item-editor]");
    }
    async function apply(wrapper: Page) {
      await wrapper.get("form[data-test=item-editor]").trigger("submit");
      await flushPromises();
    }
    const cell = (wrapper: Page, title: string, label: string) =>
      rowFor(wrapper, title).get(`td[data-label="${label}"]`).text();
    const unsaved = (wrapper: Page) => wrapper.find("[data-test=unsaved]").exists();

    it("makes an edit an unsaved change that Save turns into the next draft", async () => {
      api(order());
      const wrapper = await openPage();
      const form = await openEditor(wrapper, "Pirate Panic");

      await form.get("input[name=minutes]").setValue("20");
      await apply(wrapper);

      expect(cell(wrapper, "Pirate Panic", "Mins")).toBe("20");
      expect(unsaved(wrapper)).toBe(true);

      await wrapper.get("button[data-test=save]").trigger("click");
      await flushPromises();
      expect(wrapper.text()).toContain("Draft 7");
      expect(saves[0]?.change.halves[0].items[1]?.minutes).toBe(20);
    });

    it("edits every detail", async () => {
      api(order());
      const wrapper = await openPage();
      const form = await openEditor(wrapper, "Pirate Panic");

      await form.get("input[name=title]").setValue("Pirate Party");
      await form.get("textarea[name=cast]").setValue("Whole Cub pack");
      await form.get("select[name=stage]").setValue("Full / Apron");
      await form.get("input[name=leads]").setValue("Jo / Max");
      await form.get("textarea[name=comments]").setValue("New track");
      await form.get("input[name=minutes]").setValue("12");
      await form.get("input[name=printed]").setValue(false);
      await apply(wrapper);

      expect(cell(wrapper, "Pirate Party", "Cast")).toBe("Whole Cub pack");
      expect(cell(wrapper, "Pirate Party", "Stage")).toBe("Full / Apron");
      expect(cell(wrapper, "Pirate Party", "Leads")).toBe("Jo / Max");
      expect(cell(wrapper, "Pirate Party", "Comments")).toBe("New track");
      expect(cell(wrapper, "Pirate Party", "Mins")).toBe("12");
      expect(cell(wrapper, "Pirate Party", "#")).toBe("Not in printed programme");
    });

    it("leaves an item untimed when its minutes are cleared", async () => {
      api(order());
      const wrapper = await openPage();
      const form = await openEditor(wrapper, "Pirate Panic");

      await form.get("input[name=minutes]").setValue("");
      await apply(wrapper);

      expect(cell(wrapper, "Pirate Panic", "Mins")).toBe("Untimed");
    });

    it.each([
      ["title", "input[name=title]", "", "Enter a title (up to 120 characters)."],
      [
        "minutes",
        "input[name=minutes]",
        "-3",
        "Enter whole minutes from 0 to 240, or leave it blank.",
      ],
      [
        "minutes",
        "input[name=minutes]",
        "ten",
        "Enter whole minutes from 0 to 240, or leave it blank.",
      ],
    ])(
      "explains an invalid %s next to the field and changes nothing",
      async (_f, field, value, message) => {
        api(order());
        const wrapper = await openPage();
        const form = await openEditor(wrapper, "Pirate Panic");

        await form.get(field).setValue(value);
        await apply(wrapper);

        const input = wrapper.get(`form[data-test=item-editor] ${field}`);
        expect(input.attributes("aria-invalid")).toBe("true");
        const describedBy = input.attributes("aria-describedby") ?? "";
        expect(wrapper.get(`[id="${describedBy}"]`).text()).toBe(message);
        expect(unsaved(wrapper)).toBe(false);

        await wrapper.get("form[data-test=item-editor] button[data-test=cancel]").trigger("click");
        await flushPromises();
        expect(cell(wrapper, "Pirate Panic", "Item")).toBe("Pirate Panic");
        expect(cell(wrapper, "Pirate Panic", "Mins")).toBe("18");
      },
    );

    it("doesn't cancel the edit when Escape closes the stage list", async () => {
      api(order());
      const wrapper = await openPage();
      const form = await openEditor(wrapper, "Pirate Panic");

      await form.get("select[name=stage]").trigger("keydown", { key: "Escape" });

      expect(wrapper.find("form[data-test=item-editor]").exists()).toBe(true);
    });

    it("cancels an edit, leaving the item and the draft unchanged", async () => {
      api(order());
      const wrapper = await openPage();
      const form = await openEditor(wrapper, "Pirate Panic");

      await form.get("input[name=title]").setValue("Pirate Party");
      await form.get("button[data-test=cancel]").trigger("click");
      await flushPromises();

      expect(wrapper.find("form[data-test=item-editor]").exists()).toBe(false);
      expect(cell(wrapper, "Pirate Panic", "Item")).toBe("Pirate Panic");
      expect(unsaved(wrapper)).toBe(false);
    });

    it("renumbers the half when an item is no longer printed", async () => {
      api(order());
      const wrapper = await openPage();
      const form = await openEditor(wrapper, "Pirate Panic");

      await form.get("input[name=printed]").setValue(false);
      await apply(wrapper);

      expect(cell(wrapper, "Pirate Panic", "#")).toBe("Not in printed programme");
      expect(cell(wrapper, "Dance One", "#")).toBe("2");
    });

    it("discards unsaved edits on Reset", async () => {
      api(order());
      const wrapper = await openPage();
      const form = await openEditor(wrapper, "Pirate Panic");
      await form.get("input[name=minutes]").setValue("20");
      await apply(wrapper);

      await wrapper.get("button[data-test=reset]").trigger("click");
      await flushPromises();

      expect(cell(wrapper, "Pirate Panic", "Mins")).toBe("18");
      expect(unsaved(wrapper)).toBe(false);
    });

    it("focuses the title when editing starts and the Edit button when it ends", async () => {
      api(order());
      const wrapper = await openPage();
      await openEditor(wrapper, "Pirate Panic");

      expect(document.activeElement).toBe(
        wrapper.get("form[data-test=item-editor] input[name=title]").element,
      );

      await apply(wrapper);
      expect(document.activeElement).toBe(
        wrapper.get('button[aria-label="Edit Pirate Panic"]').element,
      );
    });

    it("holds off moves, Save and Reset while an item is being edited", async () => {
      api(order());
      const wrapper = await openPage();
      await wrapper.get('button[aria-label="Move Curtain Up down"]').trigger("click");
      await openEditor(wrapper, "Dance One");

      const disabled = (selector: string) =>
        wrapper.get(selector).attributes("disabled") !== undefined;
      expect(disabled("button[data-test=save]")).toBe(true);
      expect(disabled("button[data-test=reset]")).toBe(true);
      expect(disabled('button[aria-label="Move Curtain Up down"]')).toBe(true);
      expect(disabled('button[aria-label="Edit Curtain Up"]')).toBe(true);
    });
  });

  describe("adding and removing items", () => {
    let saves: SaveRunningOrderRequest[] = [];
    // A stand-in for the API: the running order, applying saved drafts and naming new items
    // as the server does, plus the roles and notes the removal question counts.
    function api(
      initial: RunningOrder,
      roles: RoleList["roles"] = [],
      notes: ItemNoteList["notes"] = [],
    ) {
      let latest = initial;
      saves = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          if (url.endsWith("/roles"))
            return new Response(JSON.stringify({ productionId: "2027", roles }));
          if (url.endsWith("/item-notes")) {
            return new Response(JSON.stringify({ productionId: "2027", notes }));
          }
          if (init?.method !== "POST") return new Response(JSON.stringify(latest));
          const request = SaveRunningOrderRequest.parse(JSON.parse(String(init.body)));
          saves.push(request);
          latest = {
            ...latest,
            version: latest.version + 1,
            halves: [
              { ...latest.halves[0], items: savedItems(request.change.halves[0].items) },
              { ...latest.halves[1], items: savedItems(request.change.halves[1].items) },
            ],
          };
          return new Response(JSON.stringify(latest), { status: 201 });
        }),
      );
    }

    const order = () =>
      aRunningOrder(
        [anItem("Curtain Up"), anItem("Pirate Panic"), anItem("Dance One")],
        [anItem("Big Finish")],
      );

    type Page = Awaited<ReturnType<typeof openPage>>;
    const addButton = (wrapper: Page, halfName: string) =>
      wrapper.get(`button[aria-label="Add item to the ${halfName}"]`);
    async function startAdding(wrapper: Page, halfName: string) {
      await addButton(wrapper, halfName).trigger("click");
      await flushPromises();
      return wrapper.get("form[data-test=item-editor]");
    }
    async function addTitled(wrapper: Page, halfName: string, title: string) {
      const form = await startAdding(wrapper, halfName);
      await form.get("input[name=title]").setValue(title);
      await form.trigger("submit");
      await flushPromises();
    }
    const removeButton = (wrapper: Page, title: string) =>
      wrapper.get(`button[aria-label="Remove ${title}"]`);
    async function remove(wrapper: Page, title: string, answer: boolean) {
      const confirm = vi.fn(() => answer);
      vi.stubGlobal("confirm", confirm);
      await removeButton(wrapper, title).trigger("click");
      await flushPromises();
      return confirm;
    }
    const unsaved = (wrapper: Page) => wrapper.find("[data-test=unsaved]").exists();
    const saveButton = (wrapper: Page) => wrapper.get("button[data-test=save]");
    const allTitles = (wrapper: Page) => [
      titlesIn(half(wrapper, "first-half")),
      titlesIn(half(wrapper, "second-half")),
    ];

    it("adds an item to the end of a half as an unsaved change", async () => {
      api(order());
      const wrapper = await openPage();

      await addTitled(wrapper, "second half", "Encore");

      expect(titlesIn(half(wrapper, "second-half"))).toEqual(["Big Finish", "Encore"]);
      expect(unsaved(wrapper)).toBe(true);
      expect(saveButton(wrapper).text()).toBe("Save as Draft 7");
    });

    it("saves an added item without an id, then shows the id the server gave it", async () => {
      serverIds = 0;
      api(order());
      const wrapper = await openPage();
      await addTitled(wrapper, "second half", "Encore");

      await saveButton(wrapper).trigger("click");
      await flushPromises();

      const added = saves[0]?.change.halves[1].items[1];
      expect(added).toMatchObject({ title: "Encore", printed: true, minutes: null });
      expect(added && "id" in added).toBe(false);
      expect(wrapper.find('[data-item-id="server-1"]').exists()).toBe(true);
      expect(unsaved(wrapper)).toBe(false);
    });

    it("says a new item needs a title, adding nothing", async () => {
      api(order());
      const wrapper = await openPage();

      await addTitled(wrapper, "first half", "  ");

      expect(wrapper.get(".field-error").text()).toBe("Enter a title (up to 120 characters).");
      expect(allTitles(wrapper)).toEqual([
        ["Curtain Up", "Pirate Panic", "Dance One"],
        ["Big Finish"],
      ]);
      expect(unsaved(wrapper)).toBe(false);
    });

    it("adds nothing when adding is cancelled", async () => {
      api(order());
      const wrapper = await openPage();
      const form = await startAdding(wrapper, "first half");
      await form.get("input[name=title]").setValue("Encore");

      await form.get("button[data-test=cancel]").trigger("click");
      await flushPromises();

      expect(wrapper.find("form[data-test=item-editor]").exists()).toBe(false);
      expect(allTitles(wrapper)).toEqual([
        ["Curtain Up", "Pirate Panic", "Dance One"],
        ["Big Finish"],
      ]);
      expect(unsaved(wrapper)).toBe(false);
    });

    it("labels the add form as adding, with an Add button", async () => {
      api(order());
      const wrapper = await openPage();

      const form = await startAdding(wrapper, "first half");

      expect(form.attributes("aria-label")).toBe("Add an item to the first half");
      expect(form.get("button[type=submit]").text()).toBe("Add");
    });

    it("holds off moves, edits, removals and other adds while an item is being added", async () => {
      api(order());
      const wrapper = await openPage();
      await startAdding(wrapper, "first half");

      const disabled = (selector: string) =>
        wrapper.get(selector).attributes("disabled") !== undefined;
      expect(disabled('button[aria-label="Move Curtain Up down"]')).toBe(true);
      expect(disabled('button[aria-label="Edit Curtain Up"]')).toBe(true);
      expect(disabled('button[aria-label="Remove Curtain Up"]')).toBe(true);
      expect(disabled('button[aria-label="Add item to the second half"]')).toBe(true);
    });

    it("asks before removing, naming the item and the casting that goes when it's saved", async () => {
      const dance = anItem("Dance One").id;
      api(
        order(),
        [
          {
            id: 1,
            itemId: dance,
            name: "Lead dancer",
            size: "lead",
            castMemberIds: [12],
            revision: 1,
          },
          {
            id: 2,
            itemId: dance,
            name: "Chorus",
            size: "ensemble",
            castMemberIds: [],
            revision: 1,
          },
          {
            id: 3,
            itemId: anItem("Pirate Panic").id,
            name: "Captain",
            size: "lead",
            castMemberIds: [],
            revision: 1,
          },
        ],
        [{ itemId: dance, text: "Needs tap shoes", revision: 1 }],
      );
      const wrapper = await openPage();

      const confirm = await remove(wrapper, "Dance One", false);

      expect(confirm).toHaveBeenCalledWith(
        "Remove Dance One from the running order? Saving the draft also removes its 2 roles, with who is cast in them, and its casting notes.",
      );
    });

    it("asks plainly when the item has no casting", async () => {
      api(order());
      const wrapper = await openPage();

      const confirm = await remove(wrapper, "Dance One", false);

      expect(confirm).toHaveBeenCalledWith("Remove Dance One from the running order?");
    });

    it("still warns about casting when it can't be counted", async () => {
      api(order());
      const wrapper = await openPage();
      const served = vi.mocked(fetch).getMockImplementation();
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) =>
          url.endsWith("/roles") ? new Response(null, { status: 500 }) : served?.(url, init),
        ),
      );

      const confirm = await remove(wrapper, "Dance One", false);

      expect(confirm).toHaveBeenCalledWith(
        "Remove Dance One from the running order? Saving the draft also removes any roles it has, with who is cast in them, and its casting notes.",
      );
    });

    it("removes a confirmed item as an unsaved change", async () => {
      api(order());
      const wrapper = await openPage();

      await remove(wrapper, "Dance One", true);

      expect(titlesIn(half(wrapper, "first-half"))).toEqual(["Curtain Up", "Pirate Panic"]);
      expect(unsaved(wrapper)).toBe(true);
      expect(saveButton(wrapper).text()).toBe("Save as Draft 7");
    });

    it("keeps the item when removal is cancelled", async () => {
      api(order());
      const wrapper = await openPage();

      await remove(wrapper, "Dance One", false);

      expect(titlesIn(half(wrapper, "first-half"))).toEqual([
        "Curtain Up",
        "Pirate Panic",
        "Dance One",
      ]);
      expect(unsaved(wrapper)).toBe(false);
    });

    it("shows a half emptied by a removal as empty, with its interval and total", async () => {
      api(order());
      const wrapper = await openPage();

      await remove(wrapper, "Big Finish", true);

      const second = half(wrapper, "second-half");
      expect(second.get(".empty-half").text()).toContain("No items");
      expect(second.get("[data-test=total]").text()).toBe("0 mins");
      expect(wrapper.find("[data-test=interval]").exists()).toBe(true);
    });

    it("brings a removed item back on Reset, deleting nothing", async () => {
      api(order());
      const wrapper = await openPage();
      await remove(wrapper, "Dance One", true);

      await wrapper.get("button[data-test=reset]").trigger("click");
      await flushPromises();

      expect(titlesIn(half(wrapper, "first-half"))).toEqual([
        "Curtain Up",
        "Pirate Panic",
        "Dance One",
      ]);
      expect(unsaved(wrapper)).toBe(false);
      expect(saves).toEqual([]);
    });

    it("removes an item added but not yet saved", async () => {
      api(order());
      const wrapper = await openPage();
      await addTitled(wrapper, "second half", "Encore");

      await remove(wrapper, "Encore", true);

      expect(titlesIn(half(wrapper, "second-half"))).toEqual(["Big Finish"]);
      expect(unsaved(wrapper)).toBe(false);
    });

    it("lets only admins add or remove items, saying why", async () => {
      await signInAs([]);
      api(order());
      const wrapper = await openPage();

      const add = addButton(wrapper, "first half");
      const removeDance = removeButton(wrapper, "Dance One");
      expect(add.attributes("disabled")).toBeDefined();
      expect(add.attributes("data-tooltip")).toBe("Only admins can add items");
      expect(removeDance.attributes("disabled")).toBeDefined();
      expect(removeDance.attributes("data-tooltip")).toBe("Only admins can remove items");
      useLocalSignIn();
    });

    it("lets admins add and remove items", async () => {
      await signInAs(["admin"]);
      api(order());
      const wrapper = await openPage();

      expect(addButton(wrapper, "first half").attributes("disabled")).toBeUndefined();
      expect(removeButton(wrapper, "Dance One").attributes("data-tooltip")).toBe(
        "Remove from the running order",
      );
      useLocalSignIn();
    });
  });
});
