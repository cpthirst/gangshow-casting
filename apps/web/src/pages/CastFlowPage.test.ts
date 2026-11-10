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

// Curtain up at 19:15: Opening (10 minutes, 30 of the 50 on the cast list), then the interval.
const show: RunningOrder = aRunningOrder([anItem("Opening", { minutes: 10 })]);
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
const graphOf = (wrapper: Page) => wrapper.getComponent(Line);
const lineOf = (wrapper: Page, place: string) =>
  graphOf(wrapper)
    .props("data")
    .datasets.find(({ label }) => label === place);

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

  it("draws the show's On-stage and Dressing Room counts, each level until the next start", async () => {
    serve();

    const wrapper = await openPage();

    expect(
      graphOf(wrapper)
        .props("data")
        .datasets.map(({ label }) => label),
    ).toEqual(["On-stage", "Dressing Room"]);
    expect(lineOf(wrapper, "On-stage")).toMatchObject({
      data: [
        { x: 19 * 60 + 15, y: 30 },
        { x: 19 * 60 + 25, y: 0 },
        { x: 19 * 60 + 45, y: 0 },
      ],
      // Chart.js's "before" holds each point's count until the next point.
      stepped: "before",
    });
    expect(lineOf(wrapper, "Dressing Room")?.data[0]).toEqual({ x: 19 * 60 + 15, y: 20 });
    expect(wrapper.get("canvas").attributes("role")).toBe("img");
  });

  it("puts clock times along the bottom and the number of people, from 0, up the side", async () => {
    serve();

    const wrapper = await openPage();

    const { x, y } = graphOf(wrapper).props("options")?.scales ?? {};
    const tick = x?.ticks?.callback;
    // Chart.js calls it with its scale as `this`, which the label doesn't use.
    expect(tick && Reflect.apply(tick, undefined, [19 * 60 + 5, 0, []])).toBe("7:05 pm");
    expect(x).toMatchObject({ position: "bottom", min: 19 * 60 + 15, max: 19 * 60 + 45 });
    expect(y).toMatchObject({ min: 0, title: { display: true, text: "People" } });
  });

  it("marks each start along the time with a faint dashed line up the graph", async () => {
    serve();

    const wrapper = await openPage();

    const marks = graphOf(wrapper).props("options")?.scales?.marks;
    const scale = { ticks: [{ value: 0 }] };
    if (marks?.afterBuildTicks) Reflect.apply(marks.afterBuildTicks, undefined, [scale]);
    expect(scale.ticks).toEqual([{ value: 19 * 60 + 15 }, { value: 19 * 60 + 25 }]);
    const label = marks?.ticks?.callback;
    expect(label && Reflect.apply(label, undefined, [19 * 60 + 25, 1, []])).toBe("Interval");
    // Names tilt up to upright rather than run into each other on a narrow screen.
    expect(marks).toMatchObject({
      border: { dash: [4, 4] },
      ticks: { autoSkip: false, maxRotation: 90 },
    });
  });

  it("shows every count at a moment on hovering over, clicking or tapping the graph", async () => {
    serve();

    const wrapper = await openPage();

    const options = graphOf(wrapper).props("options");
    expect(Chart.registry.getPlugin("tooltip")).toBeDefined();
    expect(options?.interaction).toMatchObject({ mode: "index", intersect: false });
    expect(options?.events).toEqual(expect.arrayContaining(["mousemove", "click", "touchstart"]));
    const title = options?.plugins?.tooltip?.callbacks?.title;
    const hovered = [{ parsed: { x: 19 * 60 + 5 } }];
    expect(title && Reflect.apply(title, undefined, [hovered])).toBe("7:05 pm");
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

    expect(lineOf(wrapper, "On-stage")?.data[0]).toEqual({ x: 19 * 60 + 15, y: 32 });
  });

  it("times the show afresh each time it opens, from the running order as saved then", async () => {
    serve();
    await openPage();
    serve({ order: aRunningOrder([anItem("Opening", { minutes: 12 })]) });

    const wrapper = await openPage();

    expect(lineOf(wrapper, "On-stage")?.data[1]).toEqual({ x: 19 * 60 + 27, y: 0 });
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
