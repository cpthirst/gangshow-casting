import { type RunningOrder, type RunningOrderItem, SaveRunningOrderRequest } from "@app/shared";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import RunningOrderPage from "./RunningOrderPage.vue";

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
  section.findAll("tbody tr").map((row) => row.get("[data-test=title]").text());
const rowFor = (wrapper: Awaited<ReturnType<typeof openPage>>, title: string) => {
  const row = wrapper.findAll("tbody tr").find((r) => r.get("[data-test=title]").text() === title);
  if (!row) throw new Error(`no row for ${title}`);
  return row;
};

describe("Running order page", () => {
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
    // A stand-in for the API: serves the latest version and applies reorders to it.
    function fakeApi(initial: RunningOrder) {
      let latest = initial;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init?: RequestInit) => {
          if (init?.method !== "POST") return new Response(JSON.stringify(latest));
          const { baseVersion, change } = SaveRunningOrderRequest.parse(
            JSON.parse(String(init.body)),
          );
          if (baseVersion !== latest.version) {
            return new Response(JSON.stringify(latest), { status: 409 });
          }
          const byId = new Map(latest.halves.flatMap((h) => h.items).map((i) => [i.id, i]));
          const itemsFor = (ids: string[]) => ids.flatMap((id) => byId.get(id) ?? []);
          latest = {
            ...latest,
            version: latest.version + 1,
            halves: [
              { ...latest.halves[0], items: itemsFor(change.halves[0].itemIds) },
              { ...latest.halves[1], items: itemsFor(change.halves[1].itemIds) },
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

    it("moves an item down, saving it as the next draft and renumbering", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      await press(wrapper, "Move Curtain Up down");

      expect(titlesIn(half(wrapper, "first-half"))).toEqual([
        "Pirate Panic",
        "Curtain Up",
        "Dance One",
      ]);
      expect(wrapper.text()).toContain("Draft 7");
      expect(rowFor(wrapper, "Pirate Panic").get("[data-test=number]").text()).toBe("1");
      expect(rowFor(wrapper, "Curtain Up").get("[data-test=number]").text()).toBe("2");
    });

    it("moves an item up", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      await press(wrapper, "Move Dance One up");

      expect(titlesIn(half(wrapper, "first-half"))).toEqual([
        "Curtain Up",
        "Dance One",
        "Pirate Panic",
      ]);
    });

    it("moves the last item of the first half to the start of the second half", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      await press(wrapper, "Move Dance One to second half");

      expect(titlesIn(half(wrapper, "first-half"))).toEqual(["Curtain Up", "Pirate Panic"]);
      expect(titlesIn(half(wrapper, "second-half"))).toEqual(["Dance One", "Big Finish"]);
    });

    it("moves an item from the second half to the end of the first half", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      await press(wrapper, "Move Big Finish to first half");

      expect(titlesIn(half(wrapper, "first-half"))).toEqual([
        "Curtain Up",
        "Pirate Panic",
        "Dance One",
        "Big Finish",
      ]);
      expect(titlesIn(half(wrapper, "second-half"))).toEqual([]);
    });

    it("doesn't offer moves that would leave the half", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      expect(moveButton(wrapper, "Move Curtain Up up").attributes("disabled")).toBeDefined();
      expect(moveButton(wrapper, "Move Big Finish down").attributes("disabled")).toBeDefined();
      expect(moveButton(wrapper, "Move Curtain Up down").attributes("disabled")).toBeUndefined();
    });

    it("shows the saved order after a reload", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();
      await press(wrapper, "Move Curtain Up down");
      wrapper.unmount();

      const reloaded = await openPage();

      expect(titlesIn(half(reloaded, "first-half"))).toEqual([
        "Pirate Panic",
        "Curtain Up",
        "Dance One",
      ]);
      expect(reloaded.text()).toContain("Draft 7");
    });

    it("shows the latest version instead of overwriting someone else's change", async () => {
      const api = fakeApi(threeItems());
      const wrapper = await openPage();
      api.someoneElseSaves(
        aRunningOrder(
          [anItem("Dance One"), anItem("Curtain Up"), anItem("Pirate Panic")],
          [anItem("Big Finish")],
          7,
        ),
      );

      await press(wrapper, "Move Curtain Up down");

      expect(wrapper.text()).toContain(
        "Someone else changed the running order. Showing the latest (Draft 7).",
      );
      expect(titlesIn(half(wrapper, "first-half"))).toEqual([
        "Dance One",
        "Curtain Up",
        "Pirate Panic",
      ]);
    });

    it("announces the move and keeps focus on the moved item", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      await press(wrapper, "Move Curtain Up down");

      expect(wrapper.get("[role=status]").text()).toBe(
        "Curtain Up moved to position 2. Saved as Draft 7.",
      );
      expect(rowFor(wrapper, "Curtain Up").element.contains(document.activeElement)).toBe(true);
    });

    it("announces a move into the other half with its new position", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();

      await press(wrapper, "Move Dance One to second half");

      expect(wrapper.get("[role=status]").text()).toBe(
        "Dance One moved to the second half, position 1. Saved as Draft 7.",
      );
    });

    it("keeps the order and says so when the save fails", async () => {
      fakeApi(threeItems());
      const wrapper = await openPage();
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      await press(wrapper, "Move Curtain Up down");

      expect(wrapper.text()).toContain("Couldn't save that change. Try again.");
      expect(titlesIn(half(wrapper, "first-half"))).toEqual([
        "Curtain Up",
        "Pirate Panic",
        "Dance One",
      ]);
      expect(wrapper.text()).toContain("Draft 6");
    });
  });
});
