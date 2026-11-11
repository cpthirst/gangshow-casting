import type { CastMember, Role, RunningOrder } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { Chart } from "chart.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Line } from "vue-chartjs";
import { createMemoryHistory } from "vue-router";
import { json, openAppAt } from "@/app.fixture.ts";
import NoRunningOrder from "@/components/common/NoRunningOrder.vue";
import { createAppRouter } from "@/router/index.ts";
import { castPath, openProduction, rolesPath, runningOrderPath } from "@/services/production.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { aCastMember, aRole, ids } from "@/utils/casting.fixture.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";
import CastFlowPage from "./CastFlowPage.vue";

enableAutoUnmount(afterEach);
afterEach(() => {
  useLocalSignIn();
  vi.unstubAllGlobals();
  openProduction("2027");
});

// Curtain up at 19:15, with Opening's calls from 19:09: Opening (10 minutes, 30 of the 50 on
// the cast list), then the interval.
const show: RunningOrder = aRunningOrder([
  anItem("Opening Number", { id: "opening", minutes: 10 }),
]);
const opening: Role[] = [aRole(1, "opening", ids(1, 30))];
const cast: CastMember[] = ids(1, 50).map((id) => aCastMember(id));

/** The stand-in API, answering for the open production; a Response answers as given. */
function serve({
  order = show,
  roles = opening,
  members = cast,
}: {
  order?: RunningOrder | Response;
  roles?: Role[] | Response;
  members?: CastMember[] | Response;
} = {}) {
  const answer = (body: object) => (body instanceof Response ? body : json(body));
  const fetchMock = vi.fn(async (url: string) => {
    if (url === runningOrderPath()) return answer(order);
    if (url === rolesPath())
      return answer(roles instanceof Response ? roles : { productionId: "2027", roles });
    if (url === castPath())
      return answer(members instanceof Response ? members : { productionId: "2027", members });
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openPage() {
  const wrapper = mount(CastFlowPage, {
    global: { plugins: [createAppRouter(createMemoryHistory())] },
  });
  await flushPromises();
  return wrapper;
}

type Page = Awaited<ReturnType<typeof openPage>>;
const PLACES = ["On-stage", "Standby", "Backstage", "Dressing Room"];
const graphsOf = (wrapper: Page) => wrapper.findAllComponents(Line);
const placeOf = (graph: ReturnType<typeof graphsOf>[number]) =>
  graph.props("data").datasets[0]?.label;
function graphOf(wrapper: Page, place: string) {
  const graph = graphsOf(wrapper).find((each) => placeOf(each) === place);
  if (!graph) throw new Error(`No ${place} graph`);
  return graph;
}
const lineOf = (wrapper: Page, place: string) => graphOf(wrapper, place).props("data").datasets[0];
const optionsOf = (wrapper: Page, place: string) => graphOf(wrapper, place).props("options");

/** A place's count from a time, in minutes after midnight, if its line has a point there. */
function countAt(wrapper: Page, place: string, minutes: number) {
  const point = lineOf(wrapper, place)?.data.find(
    (each) => typeof each === "object" && each?.x === minutes,
  );
  return typeof point === "object" ? point?.y : undefined;
}

describe("the Cast flow page", () => {
  it("opens from the menu for a team member with no department permissions", async () => {
    await signInAs([]);
    serve();
    const { wrapper, router } = await openAppAt("/");

    await wrapper.get("nav[aria-label=Main] a[href='/production/cast-flow']").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("cast-flow");
    expect(wrapper.get("h1").text()).toBe("Cast flow");
  });

  it("draws a graph for each place, stacked in order, each one line in its own colour", async () => {
    serve();

    const wrapper = await openPage();

    const graphs = graphsOf(wrapper);
    expect(graphs.map(placeOf)).toEqual(PLACES);
    expect(graphs.every((graph) => graph.props("data").datasets.length === 1)).toBe(true);
    expect(new Set(PLACES.map((place) => lineOf(wrapper, place)?.borderColor)).size).toBe(4);
    // Chart.js's "before" holds each point's count until the next point.
    expect(lineOf(wrapper, "On-stage")).toMatchObject({ stepped: "before" });
    expect(countAt(wrapper, "Backstage", 19 * 60 + 9)).toBe(30);
    expect(countAt(wrapper, "Standby", 19 * 60 + 11)).toBe(30);
    expect(countAt(wrapper, "On-stage", 19 * 60 + 15)).toBe(30);
    expect(countAt(wrapper, "Dressing Room", 19 * 60 + 15)).toBe(20);
  });

  it("heads each graph with its place and what it means", async () => {
    serve();

    const wrapper = await openPage();

    const headings = wrapper
      .findAll("[data-test=place]")
      .map((place) => [place.get("h2").text(), place.get("p").text()]);
    expect(headings).toEqual([
      ["On-stage", "Performing in the item that's running."],
      ["Standby", "In the wings, from 4 minutes before their item."],
      [
        "Backstage",
        "In the holding area for props, mics and quick changes, from 6 minutes before their item.",
      ],
      ["Dressing Room", "Everyone else on the cast list."],
    ]);
  });

  it("gives every graph the same time, with the clock times along its bottom", async () => {
    serve();

    const wrapper = await openPage();

    for (const place of PLACES) {
      const x = optionsOf(wrapper, place)?.scales?.x;
      expect(x).toMatchObject({ min: 19 * 60 + 9, max: 19 * 60 + 45 });
      expect(x?.ticks?.display).not.toBe(false);
    }
    const tick = optionsOf(wrapper, "Backstage")?.scales?.x?.ticks?.callback;
    // Chart.js calls it with its scale as `this`, which the label doesn't use.
    expect(tick && Reflect.apply(tick, undefined, [19 * 60 + 5, 0, []])).toBe("7:05 pm");
  });

  it("labels the item marks along every graph's top, each with its dashed line down the graph", async () => {
    serve();

    const wrapper = await openPage();

    for (const place of PLACES) {
      const marks = optionsOf(wrapper, place)?.scales?.marks;
      expect(marks).toMatchObject({ border: { dash: [4, 4] }, ticks: { autoSkip: false } });
      expect(marks?.ticks?.display).not.toBe(false);
    }
    const marks = optionsOf(wrapper, "Dressing Room")?.scales?.marks;
    const scale = { ticks: [{ value: 0 }] };
    if (marks?.afterBuildTicks) Reflect.apply(marks.afterBuildTicks, undefined, [scale]);
    expect(scale.ticks).toEqual([{ value: 19 * 60 + 15 }, { value: 19 * 60 + 25 }]);
    const label = marks?.ticks?.callback;
    expect(label && Reflect.apply(label, undefined, [19 * 60 + 25, 1, []])).toBe("Interval");
    expect(label && Reflect.apply(label, undefined, [19 * 60 + 15, 0, []])).toBe("1 Opening…");
    // Names tilt up to upright rather than run into each other on a narrow screen.
    expect(marks).toMatchObject({ ticks: { autoSkip: false, maxRotation: 90 } });
  });

  it("puts every graph on one people scale, from 0 to the busiest place's peak", async () => {
    serve();

    const wrapper = await openPage();

    // The Dressing Room's 50, in the interval, is the busiest any place gets.
    for (const place of PLACES) {
      expect(optionsOf(wrapper, place)?.scales?.y).toMatchObject({
        min: 0,
        max: 50,
        title: { display: true, text: "People" },
      });
    }
  });

  it.each(PLACES)(
    "shows the time, what's running and every count on hovering over, clicking or tapping the %s graph",
    async (place) => {
      serve();

      const wrapper = await openPage();

      const options = optionsOf(wrapper, place);
      expect(Chart.registry.getPlugin("tooltip")).toBeDefined();
      expect(options?.interaction).toMatchObject({ mode: "index", intersect: false });
      expect(options?.events).toEqual(expect.arrayContaining(["mousemove", "click", "touchstart"]));
      const { title, label } = options?.plugins?.tooltip?.callbacks ?? {};
      const hovered = { parsed: { x: 19 * 60 + 15 } };
      expect(title && Reflect.apply(title, undefined, [[hovered]])).toEqual([
        "7:15 pm",
        "1 Opening Number",
      ]);
      expect(label && Reflect.apply(label, undefined, [hovered])).toEqual([
        "On-stage: 30",
        "Standby: 0",
        "Backstage: 0",
        "Dressing Room: 20",
      ]);
    },
  );

  it("has a point every minute, drawn without dots, so hovering reads the minute pointed at", async () => {
    serve();

    const wrapper = await openPage();

    expect(lineOf(wrapper, "Standby")).toMatchObject({ pointRadius: 0 });
    expect(countAt(wrapper, "Standby", 19 * 60 + 12)).toBe(30);
  });

  it("lists every item's start time and counts in a table a keyboard can reach", async () => {
    serve();

    const wrapper = await openPage();

    const region = wrapper.get("[role=region][tabindex='0']");
    const rows = region
      .findAll("tbody tr")
      .map((row) => row.findAll("th, td").map((cell) => cell.text()));
    expect(rows).toEqual([["1", "Opening Number", "7:15 pm", "30", "0", "0", "20"]]);
    expect(region.findAll("thead th").map((cell) => cell.text())).toEqual([
      "#",
      "Item",
      "Starts",
      ...PLACES,
    ]);
  });

  it("leaves the number blank for an item not in the printed programme", async () => {
    serve({
      order: aRunningOrder([
        anItem("Opening Number", { id: "opening", minutes: 10, printed: false }),
      ]),
    });

    const wrapper = await openPage();

    const cells = wrapper
      .findAll("tbody tr")[0]
      ?.findAll("th, td")
      .map((cell) => cell.text());
    expect(cells?.slice(0, 2)).toEqual(["", "Opening Number"]);
  });

  it("names each graph by its place, with its description, for a screen reader", async () => {
    serve();

    const wrapper = await openPage();

    const canvas = wrapper.get("canvas[aria-label='Backstage graph']");
    expect(canvas.attributes("role")).toBe("img");
    const describedBy = canvas.attributes("aria-describedby") ?? "";
    expect(wrapper.get(`[id="${describedBy}"]`).text()).toContain("In the holding area");
  });

  it("writes the graph's text in the app's font", async () => {
    serve();
    document.body.style.fontFamily = '"Made-up Sans", sans-serif';

    await openPage();
    document.body.style.fontFamily = "";

    expect(Chart.defaults.font.family).toBe('"Made-up Sans", sans-serif');
  });

  it("works the casting out afresh each time it opens, from the show as saved then", async () => {
    serve();
    await openPage();
    serve({ roles: [aRole(1, "opening", ids(1, 32))] });

    const wrapper = await openPage();

    expect(countAt(wrapper, "On-stage", 19 * 60 + 15)).toBe(32);
  });

  it("times the show afresh each time it opens, from the running order as saved then", async () => {
    serve();
    await openPage();
    serve({ order: aRunningOrder([anItem("Opening", { minutes: 12 })]) });

    const wrapper = await openPage();

    expect(countAt(wrapper, "On-stage", 19 * 60 + 27)).toBe(0);
  });

  it("shows the production that's open", async () => {
    openProduction("2026");
    const fetchMock = serve();

    await openPage();

    const asked = fetchMock.mock.calls.map(([url]) => url);
    expect(asked).toHaveLength(3);
    expect(asked.every((url) => url.includes("/2026/"))).toBe(true);
  });

  it("says it's loading until the show has loaded", async () => {
    serve();

    const wrapper = mount(CastFlowPage, {
      global: { plugins: [createAppRouter(createMemoryHistory())] },
    });

    expect(wrapper.text()).toContain("Loading…");
    await flushPromises();
    expect(wrapper.text()).not.toContain("Loading…");
  });

  it("says there's no running order yet, rather than drawing a graph", async () => {
    serve({ order: json({}, 404) });

    const wrapper = await openPage();

    expect(wrapper.findComponent(NoRunningOrder).exists()).toBe(true);
    expect(wrapper.findComponent(Line).exists()).toBe(false);
  });

  it("says there's no cast yet, with a link to the Cast page, rather than drawing a graph", async () => {
    serve({ members: [] });

    const wrapper = await openPage();

    expect(wrapper.text()).toContain("There's no cast yet.");
    expect(wrapper.get("a[href='/cast']").text()).toBe("Cast page");
    expect(wrapper.findComponent(Line).exists()).toBe(false);
  });

  it.each([
    ["running order", { order: json({}, 500) }],
    ["roles", { roles: json({}, 500) }],
    ["cast list", { members: json({}, 500) }],
  ])(
    "reports a failed load of the %s rather than an empty state or a graph",
    async (_what, answers) => {
      serve(answers);

      const wrapper = await openPage();

      expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load the show.");
      expect(wrapper.findComponent(NoRunningOrder).exists()).toBe(false);
      expect(wrapper.findComponent(Line).exists()).toBe(false);
    },
  );
});
