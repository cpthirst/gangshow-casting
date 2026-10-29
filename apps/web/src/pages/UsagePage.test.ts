import type { AccountSummary, RunningOrder, UsageActivity, UsageSummary } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import { createAppRouter } from "@/router/index.ts";
import { useLocalSignIn } from "@/services/sign-in.ts";
import { anItem, aRunningOrder } from "@/utils/running-order.fixture.ts";
import { RUNNING_ORDER_PATH } from "@/utils/running-order.ts";
import UsagePage from "./UsagePage.vue";

enableAutoUnmount(afterEach);

// Made-up usernames only (CLAUDE.md safeguarding).
const accounts: AccountSummary[] = ["robin", "alex", "sky", "kit"].map((username) => ({
  username,
  access: ["casting"],
  enabled: true,
}));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

type Summary = Omit<UsageSummary, "activity"> & Partial<Pick<UsageSummary, "activity">>;

/** The stand-in API; with no running order saved unless one is given. */
function serve(
  // A function answers by range: null fails that range.
  usage: Summary | Response | ((days: string | null) => Summary | null),
  accountList: Response = json({ accounts }),
  order?: RunningOrder | "unavailable",
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      // A copy each time: the page asks again whenever the range changes.
      if (url === "/api/accounts") return accountList.clone();
      if (url === RUNNING_ORDER_PATH) {
        if (order === "unavailable") return json({}, 500);
        return order ? json(order) : json({}, 404);
      }
      if (usage instanceof Response) return usage;
      const days = new URL(url, "http://localhost").searchParams.get("days");
      const answer = typeof usage === "function" ? usage(days) : usage;
      return answer ? json({ activity: [], ...answer }) : json({}, 500);
    }),
  );
}

async function openPage() {
  const wrapper = mount(UsagePage, {
    global: { plugins: [createAppRouter(createMemoryHistory())] },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

type Page = Awaited<ReturnType<typeof openPage>>;
// A cell listing several things gives each list item, one per line; any other its text.
const rows = (wrapper: Page) =>
  wrapper.findAll("[data-test=by-person] tbody tr").map((row) =>
    row.findAll("td").map((cell) => {
      const lines = cell.findAll("li").map((line) => line.text());
      return lines.length > 0 ? lines : cell.text();
    }),
  );

const totals = (wrapper: Page) =>
  wrapper
    .findAll("[data-test=by-feature] tbody tr")
    .map((row) => row.findAll("th, td").map((cell) => cell.text()));

const activity = (wrapper: Page) =>
  wrapper
    .findAll("[data-test=activity] tbody tr")
    .map((row) => row.findAll("td").map((cell) => cell.text()));
const range = (wrapper: Page) => wrapper.get<HTMLSelectElement>("select[data-test=range]");
const since = { recordedSince: "2026-10-01T18:00:00.000Z", people: [], features: [] };

describe("Usage page", () => {
  // As on pnpm dev: the local app acts as an admin.
  beforeEach(useLocalSignIn);
  afterEach(() => vi.unstubAllGlobals());

  it("lists every account with its sessions in the last 30 days and its last one", async () => {
    serve({
      recordedSince: "2026-10-01T18:00:00.000Z",
      features: [],
      people: [
        { username: "robin", sessions: 2, lastSession: "2026-10-20T18:00:00.000Z", uses: {} },
        { username: "alex", sessions: 1, lastSession: "2026-10-22T18:00:00.000Z", uses: {} },
      ],
    });

    const wrapper = await openPage();

    expect(wrapper.get("h1").text()).toBe("Usage");
    expect(range(wrapper).element.value).toBe("30");
    expect(wrapper.get("[data-test=sign-in-note]").text()).toBe(
      "A sign-in lasts the day, so reopening the app within it isn't counted again.",
    );
    expect(wrapper.findAll("h2").map((h2) => h2.text())).toEqual([
      "By feature",
      "By person",
      "Recent activity",
    ]);
    expect(wrapper.findAll("[data-test=by-person] thead th").map((th) => th.text())).toEqual([
      "Username",
      "Sign-ins",
      "Last sign-in",
      "Uses",
    ]);
    expect(rows(wrapper)).toEqual([
      ["alex", "1", "22 October 2026", "No uses"],
      ["kit", "0", "No sign-ins", "No uses"],
      ["robin", "2", "20 October 2026", "No uses"],
      ["sky", "0", "No sign-ins", "No uses"],
    ]);
  });

  it("shows how often each person opened each page, in the menu's order", async () => {
    serve({
      recordedSince: "2026-10-01T18:00:00.000Z",
      features: [],
      people: [
        {
          username: "robin",
          sessions: 2,
          lastSession: "2026-10-20T18:00:00.000Z",
          uses: { cast: 1, "running-order": 3 },
        },
        { username: "alex", sessions: 1, lastSession: "2026-10-22T18:00:00.000Z", uses: {} },
      ],
    });

    const wrapper = await openPage();

    expect(rows(wrapper)).toContainEqual([
      "robin",
      "2",
      "20 October 2026",
      ["Running order 3", "Cast 1"],
    ]);
    expect(rows(wrapper)).toContainEqual(["alex", "1", "22 October 2026", "No uses"]);
  });

  it("names each page as the menu does", async () => {
    serve({
      recordedSince: "2026-10-01T18:00:00.000Z",
      features: [],
      people: [
        {
          username: "robin",
          sessions: 1,
          lastSession: "2026-10-20T18:00:00.000Z",
          uses: { "casting-overview": 2, "casting-items": 1 },
        },
      ],
    });

    const wrapper = await openPage();

    expect(rows(wrapper)).toContainEqual([
      "robin",
      "1",
      "20 October 2026",
      ["Overview 2", "Items 1"],
    ]);
  });

  it("names visits to Production's Overview as Production overview, apart from Casting's", async () => {
    serve({
      recordedSince: "2026-10-01T18:00:00.000Z",
      features: [
        { feature: "casting-overview", uses: 2, people: 1 },
        { feature: "production-overview", uses: 3, people: 1 },
      ],
      people: [
        {
          username: "robin",
          sessions: 1,
          lastSession: "2026-10-20T18:00:00.000Z",
          uses: { "production-overview": 3, "casting-overview": 2 },
        },
      ],
    });

    const wrapper = await openPage();

    expect(rows(wrapper)).toContainEqual([
      "robin",
      "1",
      "20 October 2026",
      ["Overview 2", "Production overview 3"],
    ]);
    expect(totals(wrapper)).toEqual([
      ["Overview", "2", "1"],
      ["Production overview", "3", "1"],
    ]);
    expect(wrapper.text()).not.toMatch(/Stage|Tech|Wardrobe|Costume/);
  });

  it("shows Overview views and item pages after the pages", async () => {
    serve({
      recordedSince: "2026-10-01T18:00:00.000Z",
      features: [],
      people: [
        {
          username: "robin",
          sessions: 1,
          lastSession: "2026-10-20T18:00:00.000Z",
          uses: { "item-page": 4, "overview-grid": 2, cast: 1 },
        },
      ],
    });

    const wrapper = await openPage();

    expect(rows(wrapper)).toContainEqual([
      "robin",
      "1",
      "20 October 2026",
      ["Cast 1", "Overview: Grid 2", "Item pages 4"],
    ]);
  });

  it("shows Scenery pages apart from Item pages, per person and in the totals", async () => {
    serve({
      recordedSince: "2026-10-01T18:00:00.000Z",
      features: [
        { feature: "item-page", uses: 0, people: 0 },
        { feature: "scenery-page", uses: 1, people: 1 },
      ],
      people: [
        {
          username: "robin",
          sessions: 1,
          lastSession: "2026-10-20T18:00:00.000Z",
          uses: { "scenery-page": 1 },
        },
      ],
    });

    const wrapper = await openPage();

    expect(rows(wrapper)).toContainEqual(["robin", "1", "20 October 2026", ["Scenery pages 1"]]);
    expect(totals(wrapper)).toEqual([
      ["Item pages", "0", "0"],
      ["Scenery pages", "1", "1"],
    ]);
  });

  it("shows exports after everything else", async () => {
    serve({
      recordedSince: "2026-10-01T18:00:00.000Z",
      features: [],
      people: [
        {
          username: "alex",
          sessions: 1,
          lastSession: "2026-10-22T18:00:00.000Z",
          uses: { "export-word-casting-sheets": 1, "export-excel-grid": 2, "item-page": 1 },
        },
      ],
    });

    const wrapper = await openPage();

    expect(rows(wrapper)).toContainEqual([
      "alex",
      "1",
      "22 October 2026",
      ["Item pages 1", "Export: Excel grid 2", "Export: Word casting sheets 1"],
    ]);
  });

  it("shows no last session for someone who only opened pages in the period", async () => {
    serve({
      recordedSince: "2026-10-01T18:00:00.000Z",
      features: [],
      people: [{ username: "kit", sessions: 0, lastSession: null, uses: { welcome: 1 } }],
    });

    const wrapper = await openPage();

    expect(rows(wrapper)).toContainEqual(["kit", "0", "No sign-ins", ["Welcome 1"]]);
  });

  it("matches usage to accounts whatever the case of the username", async () => {
    serve({
      recordedSince: "2026-10-01T18:00:00.000Z",
      features: [],
      people: [
        { username: "Robin", sessions: 3, lastSession: "2026-10-20T18:00:00.000Z", uses: {} },
      ],
    });

    const wrapper = await openPage();

    expect(rows(wrapper)).toContainEqual(["robin", "3", "20 October 2026", "No uses"]);
  });

  it("shows dates as they are in the UK", async () => {
    serve({
      recordedSince: "2026-10-01T18:00:00.000Z",
      features: [],
      // 23:30 UTC is 00:30 the next day in British Summer Time.
      people: [
        { username: "alex", sessions: 1, lastSession: "2026-10-20T23:30:00.000Z", uses: {} },
      ],
    });

    const wrapper = await openPage();

    expect(rows(wrapper)).toContainEqual(["alex", "1", "21 October 2026", "No uses"]);
  });

  it("totals each feature's uses and people, listing unused ones with none", async () => {
    serve({
      recordedSince: "2026-10-01T18:00:00.000Z",
      people: [],
      features: [
        { feature: "running-order", uses: 5, people: 2 },
        { feature: "export-word-item-overview", uses: 0, people: 0 },
        { feature: "export-word-casting-sheets", uses: 0, people: 0 },
      ],
    });

    const wrapper = await openPage();

    expect(wrapper.get("[data-test=by-feature]").attributes("aria-label")).toBe("Usage by feature");
    expect(wrapper.findAll("[data-test=by-feature] thead th").map((th) => th.text())).toEqual([
      "Feature",
      "Uses",
      "People",
    ]);
    expect(totals(wrapper)).toEqual([
      ["Running order", "5", "2"],
      ["Export: Word item overview", "0", "0"],
      ["Export: Word casting sheets", "0", "0"],
    ]);
  });

  it("says when usage started being recorded", async () => {
    serve({ recordedSince: "2026-10-24T08:00:00.000Z", people: [], features: [] });

    const wrapper = await openPage();

    expect(wrapper.get("[data-test=recorded-since]").text()).toBe(
      "Showing the last 30 days. Usage has been recorded since 24 October 2026.",
    );
  });

  it("says nothing has been recorded yet, still listing every account", async () => {
    serve({ recordedSince: null, people: [], features: [] });

    const wrapper = await openPage();

    expect(wrapper.get("[data-test=recorded-since]").text()).toBe(
      "Showing the last 30 days. Nothing has been recorded yet.",
    );
    expect(rows(wrapper).map(([username]) => username)).toEqual(["alex", "kit", "robin", "sky"]);
  });

  it.each([
    ["usage", json({ message: "Only admins can do this." }, 403), json({ accounts })],
    ["the accounts", json({ recordedSince: null, people: [], features: [] }), json({}, 403)],
  ])("says the page is for admins only when %s is refused", async (_what, usage, list) => {
    serve(usage, list);

    const wrapper = await openPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Only admins can see usage.");
    expect(wrapper.find("select[data-test=range]").exists()).toBe(false);
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("says when usage couldn't be loaded", async () => {
    serve(json({}, 500));

    const wrapper = await openPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load usage.");
  });

  describe("recent activity", () => {
    it("lists each session and use newest first, with who, what and when", async () => {
      serve({
        ...since,
        activity: [
          {
            username: "robin",
            at: "2026-10-20T18:01:00.000Z",
            event: "page",
            page: "running-order",
          },
          { username: "robin", at: "2026-10-20T18:00:00.000Z", event: "session" },
        ],
      });

      const wrapper = await openPage();

      expect(wrapper.get("[data-test=activity]").attributes("aria-label")).toBe("Usage activity");
      expect(wrapper.findAll("[data-test=activity] thead th").map((th) => th.text())).toEqual([
        "Username",
        "What",
        "When",
      ]);
      expect(activity(wrapper)).toEqual([
        ["robin", "opened Running order", "20 October 2026 19:01"],
        ["robin", "signed in", "20 October 2026 19:00"],
      ]);
    });

    it("says what each kind of use was", async () => {
      const at = "2026-10-20T18:00:00.000Z";
      serve({
        ...since,
        activity: [
          { username: "robin", at, event: "view", view: "grid" },
          { username: "robin", at, event: "page", page: "production-overview" },
          { username: "robin", at, event: "export", export: "word-casting-sheets" },
        ],
      });

      const wrapper = await openPage();

      expect(activity(wrapper).map(([, what]) => what)).toEqual([
        "switched the Overview to Grid",
        "opened Production overview",
        "exported the Word casting sheets",
      ]);
    });

    it("names an item by its title in the running order", async () => {
      const order = aRunningOrder([anItem("Night at the movies")]);
      const use = { event: "item" as const, productionId: "2027", itemId: "night-at-the-movies" };
      serve(
        { ...since, activity: [{ username: "robin", at: "2026-10-20T18:00:00.000Z", ...use }] },
        json({ accounts }),
        order,
      );

      const wrapper = await openPage();

      expect(activity(wrapper)[0]?.[1]).toBe("opened Night at the movies");
    });

    it.each([
      ["an item since removed", "2027", "removed-item"],
      ["an item of another production", "2026", "night-at-the-movies"],
    ])("says %s is no longer in the running order", async (_what, productionId, itemId) => {
      const order = aRunningOrder([anItem("Night at the movies")]);
      const use = { event: "item" as const, productionId, itemId };
      serve(
        { ...since, activity: [{ username: "robin", at: "2026-10-20T18:00:00.000Z", ...use }] },
        json({ accounts }),
        order,
      );

      const wrapper = await openPage();

      expect(activity(wrapper)[0]?.[1]).toBe("opened an item no longer in the running order");
    });

    it("names an item's Scenery page by the item's title", async () => {
      const order = aRunningOrder([anItem("Opening Number")]);
      const use = { event: "scenery" as const, productionId: "2027", itemId: "opening-number" };
      serve(
        { ...since, activity: [{ username: "pat", at: "2026-10-20T18:00:00.000Z", ...use }] },
        json({ accounts }),
        order,
      );

      const wrapper = await openPage();

      expect(activity(wrapper)[0]?.[1]).toBe("opened Opening Number's Scenery page");
    });

    it("says a Scenery page's item is no longer in the running order", async () => {
      const order = aRunningOrder([anItem("Opening Number")]);
      const use = { event: "scenery" as const, productionId: "2027", itemId: "cut-sketch" };
      serve(
        { ...since, activity: [{ username: "pat", at: "2026-10-20T18:00:00.000Z", ...use }] },
        json({ accounts }),
        order,
      );

      const wrapper = await openPage();

      expect(activity(wrapper)[0]?.[1]).toBe(
        "opened a Scenery page of an item no longer in the running order",
      );
    });

    it("still lists a Scenery page's use when the running order can't be loaded", async () => {
      const use = { event: "scenery" as const, productionId: "2027", itemId: "opening-number" };
      serve(
        { ...since, activity: [{ username: "pat", at: "2026-10-20T18:00:00.000Z", ...use }] },
        json({ accounts }),
        "unavailable",
      );

      const wrapper = await openPage();

      expect(activity(wrapper)[0]?.[1]).toBe("opened an item's Scenery page");
    });

    it("still lists an item's use, as an item, when the running order can't be loaded", async () => {
      const use = { event: "item" as const, productionId: "2027", itemId: "night-at-the-movies" };
      serve(
        {
          ...since,
          features: [{ feature: "item-page", uses: 1, people: 1 }],
          activity: [{ username: "robin", at: "2026-10-20T18:00:00.000Z", ...use }],
        },
        json({ accounts }),
        "unavailable",
      );

      const wrapper = await openPage();

      expect(activity(wrapper)[0]?.[1]).toBe("opened an item");
      expect(totals(wrapper)).toEqual([["Item pages", "1", "1"]]);
    });

    it("shows the newest 50, and the next 50 on asking", async () => {
      const entries: UsageActivity[] = Array.from({ length: 120 }, (_, n) => ({
        username: "robin",
        at: new Date(Date.UTC(2026, 9, 20, 12, 120 - n)).toISOString(),
        event: "session",
      }));
      serve({ ...since, activity: entries });

      const wrapper = await openPage();
      expect(activity(wrapper)).toHaveLength(50);
      expect(activity(wrapper)[0]?.[2]).toBe("20 October 2026 15:00");

      await wrapper.get("[data-test=more-activity]").trigger("click");
      await flushPromises();
      expect(activity(wrapper)).toHaveLength(100);
      // Keyboard and screen-reader users carry on from the first row just shown.
      const rows = wrapper.findAll("[data-test=activity] tbody tr");
      expect(document.activeElement).toBe(rows[50]?.element);

      await wrapper.get("[data-test=more-activity]").trigger("click");
      await flushPromises();
      expect(activity(wrapper)).toHaveLength(120);
      expect(wrapper.find("[data-test=more-activity]").exists()).toBe(false);
    });

    it("says there's no activity in the period", async () => {
      serve(since);

      const wrapper = await openPage();

      expect(wrapper.get("[data-test=no-activity]").text()).toBe("No activity in this period.");
      expect(wrapper.find("[data-test=activity]").exists()).toBe(false);
    });

    it("shows times as they are in the UK, in winter too", async () => {
      serve({
        ...since,
        activity: [{ username: "robin", at: "2026-12-01T18:00:00.000Z", event: "session" }],
      });

      const wrapper = await openPage();

      expect(activity(wrapper)[0]?.[2]).toBe("1 December 2026 18:00");
    });
  });

  describe("the date range", () => {
    const at = "2026-10-20T18:00:00.000Z";
    const byRange = (days: string | null): Summary =>
      days === "7"
        ? {
            ...since,
            people: [{ username: "robin", sessions: 1, lastSession: at, uses: {} }],
            features: [{ feature: "cast", uses: 0, people: 0 }],
            activity: [{ username: "robin", at, event: "session" }],
          }
        : {
            ...since,
            people: [{ username: "robin", sessions: 2, lastSession: at, uses: { cast: 1 } }],
            features: [{ feature: "cast", uses: 1, people: 1 }],
            activity: [
              { username: "robin", at, event: "session" },
              { username: "robin", at: "2026-10-10T18:00:00.000Z", event: "session" },
            ],
          };

    it("opens on the last 30 days, offering 7, 30 and 90", async () => {
      serve(byRange);

      const wrapper = await openPage();

      expect(range(wrapper).element.value).toBe("30");
      expect(
        range(wrapper)
          .findAll("option")
          .map((option) => option.text()),
      ).toEqual(["Last 7 days", "Last 30 days", "Last 90 days"]);
      expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/usage?days=30");
    });

    it("changes every part of the page to the range chosen", async () => {
      serve(byRange);
      const wrapper = await openPage();

      await range(wrapper).setValue("7");
      await flushPromises();

      expect(wrapper.get("[data-test=recorded-since]").text()).toMatch(
        /^Showing the last 7 days\. /,
      );
      expect(rows(wrapper)).toContainEqual(["robin", "1", "20 October 2026", "No uses"]);
      expect(totals(wrapper)).toEqual([["Cast", "0", "0"]]);
      expect(activity(wrapper)).toEqual([["robin", "signed in", "20 October 2026 19:00"]]);
    });

    it("asks for the last 90 days when chosen", async () => {
      serve(byRange);
      const wrapper = await openPage();

      await range(wrapper).setValue("90");
      await flushPromises();

      expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/usage?days=90");
    });

    it("keeps the range choice when a range fails to load, so another can be tried", async () => {
      serve((days) => (days === "90" ? null : byRange(days)));
      const wrapper = await openPage();

      await range(wrapper).setValue("90");
      await flushPromises();

      expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load usage.");
      await range(wrapper).setValue("7");
      await flushPromises();
      expect(activity(wrapper)).toEqual([["robin", "signed in", "20 October 2026 19:00"]]);
    });

    it("shows the range chosen last, even if an earlier one answers after it", async () => {
      let answer7 = () => {};
      const slow7 = new Promise<void>((resolve) => {
        answer7 = resolve;
      });
      serve(byRange);
      const wrapper = await openPage();
      const answer = vi.mocked(fetch).getMockImplementation();
      vi.mocked(fetch).mockImplementation(async (input, init) => {
        if (String(input).endsWith("days=7")) await slow7;
        return answer ? answer(input, init) : new Response(null, { status: 500 });
      });

      await range(wrapper).setValue("7");
      await range(wrapper).setValue("30");
      await flushPromises();
      answer7();
      await flushPromises();

      expect(rows(wrapper)).toContainEqual(["robin", "2", "20 October 2026", ["Cast 1"]]);
    });

    it("names the range choice for screen readers, keeping focus on it as the page changes", async () => {
      serve(byRange);
      const wrapper = await openPage();
      const select = range(wrapper);

      expect(wrapper.get(`label[for="${select.attributes("id")}"]`).text()).toBe("Period");
      select.element.focus();
      await select.setValue("7");
      await flushPromises();

      expect(document.activeElement).toBe(range(wrapper).element);
    });
  });
});
