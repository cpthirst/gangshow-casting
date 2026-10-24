import { expect, it } from "vitest";
import type { UsageStore } from "./usage-store.ts";

const session = (username: string, at: string) => ({ username, event: "session" as const, at });

/** The rules every usage store keeps, run against each implementation. */
export function behavesAsAUsageStore(make: () => UsageStore) {
  it("has no usage, and no start date, before anything is recorded", async () => {
    const store = make();

    expect(await store.since("2026-01-01T00:00:00.000Z")).toEqual([]);
    expect(await store.recordedSince()).toBeUndefined();
  });

  it("returns what was recorded from a time on, oldest first", async () => {
    const store = make();
    await store.record(session("robin", "2026-10-01T19:00:00.000Z"));
    await store.record(session("alex", "2026-10-22T19:00:00.000Z"));
    await store.record(session("robin", "2026-10-20T19:00:00.000Z"));

    expect(await store.since("2026-10-02T00:00:00.000Z")).toEqual([
      session("robin", "2026-10-20T19:00:00.000Z"),
      session("alex", "2026-10-22T19:00:00.000Z"),
    ]);
  });

  it("keeps which menu page a page use is of", async () => {
    const store = make();
    const use = { username: "robin", event: "page" as const, page: "cast" as const };
    await store.record({ ...use, at: "2026-10-20T19:00:00.000Z" });

    expect(await store.since("2026-10-01T00:00:00.000Z")).toEqual([
      { ...use, at: "2026-10-20T19:00:00.000Z" },
    ]);
  });

  it("keeps two sessions at the same moment apart", async () => {
    const store = make();
    await store.record(session("robin", "2026-10-20T19:00:00.000Z"));
    await store.record(session("robin", "2026-10-20T19:00:00.000Z"));

    expect(await store.since("2026-10-01T00:00:00.000Z")).toHaveLength(2);
  });

  it("starts the record on the first thing recorded, and keeps that date", async () => {
    const store = make();
    await store.record(session("robin", "2026-10-24T09:00:00.000Z"));
    await store.record(session("alex", "2026-10-25T09:00:00.000Z"));

    expect(await store.recordedSince()).toBe("2026-10-24T09:00:00.000Z");
  });
}
