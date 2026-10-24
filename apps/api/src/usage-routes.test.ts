import { type MenuPageName, UsageSummary } from "@app/shared";
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
  const summary = async () => {
    await ready;
    const res = await routes["GET /api/usage"]({});
    expect(res.statusCode).toBe(200);
    return UsageSummary.parse(JSON.parse(res.body ?? ""));
  };
  return { store, record: routes["POST /api/usage"], summary };
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

  it("lists someone who only opened pages in the period, with no last session", async () => {
    const { summary } = setUp([session("robin", daysAgo(31)), opened("robin", "cast", daysAgo(2))]);

    expect((await summary()).people).toEqual([
      { username: "robin", sessions: 0, lastSession: null, uses: { cast: 1 } },
    ]);
  });

  it("says when recording started", async () => {
    const { summary } = setUp([session("robin", "2026-10-01T19:00:00.000Z")]);

    expect((await summary()).recordedSince).toBe("2026-10-01T19:00:00.000Z");
  });

  it("says nothing has been recorded yet", async () => {
    const { summary } = setUp();

    expect(await summary()).toEqual({ recordedSince: null, people: [] });
  });
});
