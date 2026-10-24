import { type MenuPageName, UsageFeature, UsageSummary } from "@app/shared";
import { describe, expect, it } from "vitest";
import { createUsageRoutes } from "./usage-routes.ts";
import { inMemoryUsageStore, type UsageRecord } from "./usage-store.ts";

const NOW = new Date("2026-10-23T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const signedInAs = (username: string, body: unknown = { event: "session" }) => ({
  body: JSON.stringify(body),
  requestContext: { authorizer: { jwt: { claims: { username } } } },
});
const session = (username: string, at: string) => ({ username, event: "session" as const, at });
const opened = (username: string, page: MenuPageName, at: string) => ({
  username,
  event: "page" as const,
  page,
  at,
});

function setUp(records: UsageRecord[] = []) {
  const store = inMemoryUsageStore();
  const routes = createUsageRoutes(store, { now: () => NOW });
  const ready = Promise.all(records.map((record) => store.record(record)));
  const summary = async (days?: string) => {
    await ready;
    const res = await routes["GET /api/usage"](
      days === undefined ? {} : { queryStringParameters: { days } },
    );
    expect(res.statusCode).toBe(200);
    return UsageSummary.parse(JSON.parse(res.body ?? ""));
  };
  return { store, routes, record: routes["POST /api/usage"], summary };
}

describe("recording usage", () => {
  it("records a session for the person signed in, at the time it arrives", async () => {
    const { store, record } = setUp();

    const res = await record(signedInAs("robin"));

    expect(res.statusCode).toBe(204);
    expect(await store.since(daysAgo(1))).toEqual([session("robin", NOW.toISOString())]);
  });

  it("records the session for the person signed in, whoever the request names", async () => {
    const { store, record } = setUp();

    await record(signedInAs("robin", { event: "session", username: "alex" }));

    expect(await store.since(daysAgo(1))).toEqual([session("robin", NOW.toISOString())]);
  });

  it("records opening a menu page for the person signed in", async () => {
    const { store, record } = setUp();

    const res = await record(signedInAs("robin", { event: "page", page: "running-order" }));

    expect(res.statusCode).toBe(204);
    expect(await store.since(daysAgo(1))).toEqual([
      opened("robin", "running-order", NOW.toISOString()),
    ]);
  });

  it("records an Overview view switch and an item's page, naming only the item", async () => {
    const { store, record } = setUp();

    await record(signedInAs("robin", { event: "view", view: "grid" }));
    await record(
      signedInAs("robin", {
        event: "item",
        productionId: "2027",
        itemId: "made-up-item",
        title: "Night at the movies",
      }),
    );

    const at = NOW.toISOString();
    expect(await store.since(daysAgo(1))).toEqual([
      { username: "robin", event: "view", view: "grid", at },
      { username: "robin", event: "item", productionId: "2027", itemId: "made-up-item", at },
    ]);
  });

  it.each([
    ["not JSON"],
    [JSON.stringify({ event: "Admin secrets" })],
    [JSON.stringify({ event: "page", page: "Admin secrets" })],
    [JSON.stringify({ event: "item", productionId: "2027", itemId: "" })],
    [JSON.stringify({ event: "item", productionId: "../secrets", itemId: "made-up-item" })],
  ])("refuses %s as invalid, recording nothing", async (body) => {
    const { store, record } = setUp();

    const res = await record({ ...signedInAs("robin"), body });

    expect(res.statusCode).toBe(400);
    expect(await store.since(daysAgo(1))).toEqual([]);
  });

  it("refuses a signed-in request that doesn't say who it's from, rather than guess", async () => {
    const { store, record } = setUp();

    const res = await record({
      body: JSON.stringify({ event: "session" }),
      requestContext: { authorizer: { jwt: { claims: { sub: "made-up" } } } },
    });

    expect(res.statusCode).toBe(403);
    expect(await store.since(daysAgo(1))).toEqual([]);
  });
});

describe("reading usage", () => {
  it("gives each person's number of sessions and their last one", async () => {
    const { summary } = setUp([
      session("robin", "2026-10-01T19:00:00.000Z"),
      session("robin", "2026-10-20T19:00:00.000Z"),
      session("alex", "2026-10-22T19:00:00.000Z"),
    ]);

    expect((await summary()).people).toEqual([
      { username: "alex", sessions: 1, lastSession: "2026-10-22T19:00:00.000Z", uses: {} },
      { username: "robin", sessions: 2, lastSession: "2026-10-20T19:00:00.000Z", uses: {} },
    ]);
  });

  it("counts one person's sessions together whatever the case of their username", async () => {
    const { summary } = setUp([session("Robin", daysAgo(3)), session("robin", daysAgo(2))]);

    expect((await summary()).people).toEqual([
      { username: "Robin", sessions: 2, lastSession: daysAgo(2), uses: {} },
    ]);
  });

  it("counts only the last 30 days", async () => {
    const { summary } = setUp([session("robin", daysAgo(31)), session("robin", daysAgo(2))]);

    expect((await summary()).people).toEqual([
      { username: "robin", sessions: 1, lastSession: daysAgo(2), uses: {} },
    ]);
  });

  it("never counts a session older than 90 days, even before it's removed, as it counts only 30", async () => {
    const { summary } = setUp([session("robin", daysAgo(91))]);

    expect((await summary()).people).toEqual([]);
  });

  it("counts each menu page each person opened", async () => {
    const { summary } = setUp([
      session("robin", daysAgo(3)),
      opened("robin", "running-order", daysAgo(3)),
      opened("robin", "running-order", daysAgo(2)),
      opened("robin", "cast", daysAgo(2)),
      opened("Robin", "running-order", daysAgo(1)),
      session("alex", daysAgo(1)),
    ]);

    expect((await summary()).people).toEqual([
      { username: "alex", sessions: 1, lastSession: daysAgo(1), uses: {} },
      {
        username: "robin",
        sessions: 1,
        lastSession: daysAgo(3),
        uses: { "running-order": 3, cast: 1 },
      },
    ]);
  });

  it("counts each person's Overview views and item pages", async () => {
    const view = (at: string) => ({
      username: "robin",
      event: "view" as const,
      view: "grid" as const,
      at,
    });
    const item = (itemId: string, at: string) => ({
      username: "robin",
      event: "item" as const,
      productionId: "2027",
      itemId,
      at,
    });
    const { summary } = setUp([
      view(daysAgo(3)),
      view(daysAgo(2)),
      item("made-up-item", daysAgo(3)),
      item("made-up-item", daysAgo(2)),
      item("another-item", daysAgo(2)),
      item("another-item", daysAgo(1)),
    ]);

    expect((await summary()).people).toEqual([
      {
        username: "robin",
        sessions: 0,
        lastSession: null,
        uses: { "overview-grid": 2, "item-page": 4 },
      },
    ]);
  });

  it("counts each person's exports", async () => {
    const exported = (kind: "excel-grid" | "word-casting-sheets", at: string) => ({
      username: "alex",
      event: "export" as const,
      export: kind,
      at,
    });
    const { summary } = setUp([
      exported("excel-grid", daysAgo(3)),
      exported("excel-grid", daysAgo(2)),
      exported("word-casting-sheets", daysAgo(1)),
    ]);

    expect((await summary()).people).toEqual([
      {
        username: "alex",
        sessions: 0,
        lastSession: null,
        uses: { "export-excel-grid": 2, "export-word-casting-sheets": 1 },
      },
    ]);
  });

  it("lists someone who only opened pages in the period, with no last session", async () => {
    const { summary } = setUp([session("robin", daysAgo(31)), opened("robin", "cast", daysAgo(2))]);

    expect((await summary()).people).toEqual([
      { username: "robin", sessions: 0, lastSession: null, uses: { cast: 1 } },
    ]);
  });

  it("totals each feature's uses and the different people who used it", async () => {
    const { summary } = setUp([
      opened("robin", "running-order", daysAgo(3)),
      opened("robin", "running-order", daysAgo(2)),
      opened("Robin", "running-order", daysAgo(1)),
      opened("alex", "running-order", daysAgo(2)),
      opened("alex", "running-order", daysAgo(1)),
    ]);

    expect((await summary()).features).toContainEqual({
      feature: "running-order",
      uses: 5,
      people: 2,
    });
  });

  it("lists every feature once, in a fixed order, with none for those unused", async () => {
    const { summary } = setUp([opened("robin", "cast", daysAgo(1))]);

    const { features } = await summary();

    expect(features.map(({ feature }) => feature)).toEqual([
      "welcome",
      "running-order",
      "cast",
      "casting-overview",
      "casting-items",
      "accounts",
      "usage",
      "overview-by-person",
      "overview-by-item",
      "overview-grid",
      "item-page",
      "export-excel-grid",
      "export-word-casting-sheets",
      "export-word-item-overview",
    ]);
    expect(features).toContainEqual({ feature: "export-word-item-overview", uses: 0, people: 0 });
    expect(features).toContainEqual({ feature: "export-word-casting-sheets", uses: 0, people: 0 });
  });

  it("totals only the last 30 days", async () => {
    const { summary } = setUp([
      opened("robin", "cast", daysAgo(31)),
      opened("alex", "cast", daysAgo(2)),
    ]);

    expect((await summary()).features).toContainEqual({ feature: "cast", uses: 1, people: 1 });
  });

  it("counts no session towards any feature", async () => {
    const { summary } = setUp([session("robin", daysAgo(1)), session("robin", daysAgo(2))]);

    const { features } = await summary();

    expect(features.every(({ uses, people }) => uses === 0 && people === 0)).toBe(true);
  });

  it("lists each session and use, newest first", async () => {
    const { summary } = setUp([
      session("robin", "2026-10-20T19:00:00.000Z"),
      opened("robin", "running-order", "2026-10-20T19:01:00.000Z"),
      session("alex", "2026-09-20T19:00:00.000Z"),
    ]);

    expect((await summary()).activity).toEqual([
      opened("robin", "running-order", "2026-10-20T19:01:00.000Z"),
      session("robin", "2026-10-20T19:00:00.000Z"),
    ]);
  });

  it("lists at most the newest 1,000 activities", async () => {
    const minutesAgo = (minutes: number) =>
      new Date(NOW.getTime() - minutes * 60_000).toISOString();
    const { summary } = setUp(
      Array.from({ length: 1001 }, (_, minutes) => session("robin", minutesAgo(minutes))),
    );

    const { activity, people } = await summary();

    expect(activity).toHaveLength(1000);
    expect(activity[0]?.at).toBe(minutesAgo(0));
    expect(activity.at(-1)?.at).toBe(minutesAgo(999));
    expect(people[0]?.sessions).toBe(1001);
  });

  it("says when recording started", async () => {
    const { summary } = setUp([session("robin", "2026-10-01T19:00:00.000Z")]);

    expect((await summary()).recordedSince).toBe("2026-10-01T19:00:00.000Z");
  });

  it("says nothing has been recorded yet", async () => {
    const { summary } = setUp();

    expect(await summary()).toEqual({
      recordedSince: null,
      people: [],
      features: UsageFeature.options.map((feature) => ({ feature, uses: 0, people: 0 })),
      activity: [],
    });
  });
});

describe("choosing the range", () => {
  it("counts, totals and lists only the last 7 days when asked", async () => {
    const { summary } = setUp([
      session("robin", daysAgo(10)),
      session("robin", daysAgo(2)),
      opened("robin", "cast", daysAgo(10)),
    ]);

    const { people, features, activity } = await summary("7");

    expect(people).toEqual([{ username: "robin", sessions: 1, lastSession: daysAgo(2), uses: {} }]);
    expect(features).toContainEqual({ feature: "cast", uses: 0, people: 0 });
    expect(activity).toEqual([session("robin", daysAgo(2))]);
  });

  it("covers the last 30 days when no range is asked for", async () => {
    const { summary } = setUp([session("robin", daysAgo(40)), session("robin", daysAgo(2))]);

    expect((await summary()).people[0]?.sessions).toBe(1);
  });

  it("counts and lists everything kept over the last 90 days", async () => {
    const { summary } = setUp([session("robin", daysAgo(60))]);

    const { people, activity } = await summary("90");

    expect(people[0]?.sessions).toBe(1);
    expect(activity).toEqual([session("robin", daysAgo(60))]);
  });

  it("never counts a session older than 90 days, even before the table removes it", async () => {
    const { summary } = setUp([session("robin", daysAgo(91))]);

    expect((await summary("90")).people).toEqual([]);
  });

  it.each(["365", "seven"])("refuses %s days as invalid", async (days) => {
    const { routes } = setUp();

    const res = await routes["GET /api/usage"]({ queryStringParameters: { days } });

    expect(res.statusCode).toBe(400);
  });
});
