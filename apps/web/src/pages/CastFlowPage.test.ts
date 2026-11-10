import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { Chart } from "chart.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Line } from "vue-chartjs";
import { createMemoryHistory } from "vue-router";
import { json, openAppAt } from "@/app.fixture.ts";
import { createAppRouter } from "@/router/index.ts";
import { signInAs } from "@/services/sign-in.fixture.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import CastFlowPage from "./CastFlowPage.vue";

enableAutoUnmount(afterEach);
afterEach(() => {
  useLocalSignIn();
  vi.unstubAllGlobals();
});

async function openPage() {
  const wrapper = mount(CastFlowPage, {
    global: { plugins: [createAppRouter(createMemoryHistory())] },
  });
  await flushPromises();
  return wrapper;
}

describe("the Cast flow page", () => {
  it("opens from the menu for a team member with no department permissions", async () => {
    await signInAs([]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({})),
    );
    const { wrapper, router } = await openAppAt("/");

    await wrapper.get("nav[aria-label=Main] a[href='/production/cast-flow']").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("cast-flow");
    expect(wrapper.get("h1").text()).toBe("Cast flow");
  });

  it("draws one line per place, each in its own colour, against the same scale", async () => {
    const wrapper = await openPage();

    const graph = wrapper.getComponent(Line);
    const { datasets } = graph.props("data");
    expect(datasets.map(({ label }) => label)).toEqual([
      "On-stage",
      "Standby",
      "Backstage",
      "Dressing Room",
    ]);
    expect(new Set(datasets.map(({ borderColor }) => borderColor)).size).toBe(4);
    expect(datasets.every(({ yAxisID }) => yAxisID === undefined)).toBe(true);
    expect(wrapper.get("canvas").attributes("role")).toBe("img");
  });

  it("puts clock times along the bottom and the number of people up the side", async () => {
    const wrapper = await openPage();

    const { x, y } = wrapper.getComponent(Line).props("options")?.scales ?? {};
    const tick = x?.ticks?.callback;
    // Chart.js calls it with its scale as `this`, which the label doesn't use.
    expect(tick && Reflect.apply(tick, undefined, [19 * 60 + 5, 0, []])).toBe("7:05 pm");
    expect(y).toMatchObject({ min: 0, title: { display: true, text: "People" } });
    const first = wrapper.getComponent(Line).props("data").datasets[0]?.data[0];
    expect(first).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
  });

  it("shows every place's count at a moment on hovering over, clicking or tapping the graph", async () => {
    const wrapper = await openPage();

    const options = wrapper.getComponent(Line).props("options");
    expect(Chart.registry.getPlugin("tooltip")).toBeDefined();
    expect(options?.interaction).toMatchObject({ mode: "index", intersect: false });
    expect(options?.events).toEqual(expect.arrayContaining(["mousemove", "click", "touchstart"]));
    const title = options?.plugins?.tooltip?.callbacks?.title;
    const hovered = [{ parsed: { x: 19 * 60 + 5 } }];
    expect(title && Reflect.apply(title, undefined, [hovered])).toBe("7:05 pm");
  });
});
