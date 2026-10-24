import type { AccountSummary, UsageSummary } from "@app/shared";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import { createAppRouter } from "../router.ts";
import { useLocalSignIn } from "../sign-in.ts";
import UsagePage from "./UsagePage.vue";

enableAutoUnmount(afterEach);

// Made-up usernames only (CLAUDE.md safeguarding).
const accounts: AccountSummary[] = ["robin", "alex", "sky", "kit"].map((username) => ({
  username,
  role: "casting",
  enabled: true,
}));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function serve(usage: UsageSummary | Response, accountList: Response = json({ accounts })) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url === "/api/accounts" ? accountList : usage instanceof Response ? usage : json(usage),
    ),
  );
}

async function openPage() {
  const wrapper = mount(UsagePage, {
    global: { plugins: [createAppRouter(createMemoryHistory())] },
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
    expect(wrapper.get("[data-test=range]").text()).toBe("Last 30 days");
    expect(wrapper.findAll("h2").map((h2) => h2.text())).toEqual(["By feature", "By person"]);
    expect(wrapper.findAll("[data-test=by-person] thead th").map((th) => th.text())).toEqual([
      "Username",
      "Sessions",
      "Last session",
      "Uses",
    ]);
    expect(rows(wrapper)).toEqual([
      ["alex", "1", "22 October 2026", "No uses"],
      ["kit", "0", "No sessions", "No uses"],
      ["robin", "2", "20 October 2026", "No uses"],
      ["sky", "0", "No sessions", "No uses"],
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

    expect(rows(wrapper)).toContainEqual(["kit", "0", "No sessions", ["Welcome 1"]]);
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
      "Usage has been recorded since 24 October 2026.",
    );
  });

  it("says nothing has been recorded yet, still listing every account", async () => {
    serve({ recordedSince: null, people: [], features: [] });

    const wrapper = await openPage();

    expect(wrapper.get("[data-test=recorded-since]").text()).toBe("Nothing has been recorded yet.");
    expect(rows(wrapper).map(([username]) => username)).toEqual(["alex", "kit", "robin", "sky"]);
  });

  it.each([
    ["usage", json({ message: "Only admins can do this." }, 403), json({ accounts })],
    ["the accounts", json({ recordedSince: null, people: [], features: [] }), json({}, 403)],
  ])("says the page is for admins only when %s is refused", async (_what, usage, list) => {
    serve(usage, list);

    const wrapper = await openPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Only admins can see usage.");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("says when usage couldn't be loaded", async () => {
    serve(json({}, 500));

    const wrapper = await openPage();

    expect(wrapper.get("[role=alert]").text()).toBe("Couldn't load usage.");
  });
});
