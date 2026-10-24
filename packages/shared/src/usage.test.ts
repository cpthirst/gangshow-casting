import { describe, expect, it } from "vitest";
import { RecordUsageRequest, UsageSummary } from "./usage.ts";

describe("RecordUsageRequest", () => {
  it("accepts a session", () => {
    expect(RecordUsageRequest.parse({ event: "session" })).toEqual({ event: "session" });
  });

  it("drops anything that names who it's for, which only the sign-in says", () => {
    expect(RecordUsageRequest.parse({ event: "session", username: "alex" })).toEqual({
      event: "session",
    });
  });

  it.each([[{}], [{ event: "Admin secrets" }], [{ event: 1 }]])("refuses %j", (body) => {
    expect(RecordUsageRequest.safeParse(body).success).toBe(false);
  });
});

describe("UsageSummary", () => {
  it("holds when recording started and each person's sessions", () => {
    const summary = {
      recordedSince: "2026-10-24T09:00:00.000Z",
      people: [{ username: "robin", sessions: 2, lastSession: "2026-10-20T19:00:00.000Z" }],
    };
    expect(UsageSummary.parse(summary)).toEqual(summary);
  });

  it("says nothing has been recorded yet with no start date", () => {
    expect(UsageSummary.parse({ recordedSince: null, people: [] }).recordedSince).toBeNull();
  });
});
