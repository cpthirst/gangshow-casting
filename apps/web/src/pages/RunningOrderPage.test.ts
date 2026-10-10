import type { RunningOrder, RunningOrderItem } from "@app/shared";
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
  const wrapper = mount(RunningOrderPage);
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
  afterEach(() => vi.unstubAllGlobals());

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
});
