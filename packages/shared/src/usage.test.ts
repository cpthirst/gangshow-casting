import { describe, expect, it } from "vitest";
import { featureOf, RecordUsageRequest, UsageQuery, UsageSummary } from "./usage.ts";

describe("RecordUsageRequest", () => {
  it("accepts a session", () => {
    expect(RecordUsageRequest.parse({ event: "session" })).toEqual({ event: "session" });
  });

  it("drops anything that names who it's for, which only the sign-in says", () => {
    expect(RecordUsageRequest.parse({ event: "session", username: "alex" })).toEqual({
      event: "session",
    });
  });

  it.each([
    "welcome",
    "running-order",
    "cast",
    "casting-overview",
    "casting-items",
    "stage",
    "tech",
    "costume",
    "help",
    "accounts",
    "usage",
  ])("accepts opening the menu page %s", (page) => {
    expect(RecordUsageRequest.parse({ event: "page", page })).toEqual({ event: "page", page });
  });

  it.each(["by-person", "by-item", "grid"])("accepts switching the Overview to %s", (view) => {
    expect(RecordUsageRequest.parse({ event: "view", view })).toEqual({ event: "view", view });
  });

  it.each(["mic-plot", "props", "scenery", "sfx"])(
    "refuses opening %s, which is no longer a menu page",
    (page) => {
      expect(RecordUsageRequest.safeParse({ event: "page", page }).success).toBe(false);
    },
  );

  it.each(["scenery", "props", "mic-plot", "sfx"])("accepts switching to the %s view", (view) => {
    expect(RecordUsageRequest.parse({ event: "view", view })).toEqual({ event: "view", view });
  });

  it("accepts opening an item's page, naming the item and its production", () => {
    const use = { event: "item", productionId: "2027", itemId: "made-up-item" };
    expect(RecordUsageRequest.parse(use)).toEqual(use);
  });

  it("drops an item's title, keeping only which item it is", () => {
    const use = { event: "item", productionId: "2027", itemId: "made-up-item" };
    expect(RecordUsageRequest.parse({ ...use, title: "Night at the movies" })).toEqual(use);
  });

  it.each(["excel-grid", "word-casting-sheets", "word-item-overview", "word-props-list"])(
    "accepts the export %s",
    (exported) => {
      const use = { event: "export", export: exported };
      expect(RecordUsageRequest.parse(use)).toEqual(use);
    },
  );

  it.each([
    [{}],
    [{ event: "Admin secrets" }],
    [{ event: 1 }],
    [{ event: "page" }],
    [{ event: "page", page: "Admin secrets" }],
    [{ event: "page", page: "not-found" }],
    [{ event: "view", view: "timeline" }],
    [{ event: "export", export: "pdf" }],
    [{ event: "item", productionId: "2027" }],
    [{ event: "item", productionId: "../2027", itemId: "made-up-item" }],
    [{ event: "item", productionId: "2027", itemId: "" }],
    [{ event: "item", productionId: "2027", itemId: "x".repeat(41) }],
    [{ event: "item", productionId: "2027", itemId: "Sam Example in the front row" }],
  ])("refuses %j", (body) => {
    expect(RecordUsageRequest.safeParse(body).success).toBe(false);
  });
});

describe("featureOf", () => {
  it("names the menu page a page use is of", () => {
    expect(featureOf({ event: "page", page: "running-order" })).toBe("running-order");
  });

  it("names the Overview view switched to", () => {
    expect(featureOf({ event: "view", view: "grid" })).toBe("overview-grid");
  });

  it.each([
    ["scenery", "stage-scenery"],
    ["props", "stage-props"],
    ["mic-plot", "tech-mic-plot"],
    ["sfx", "tech-sfx"],
  ] as const)("names the %s view as a use of its page's view", (view, feature) => {
    expect(featureOf({ event: "view", view })).toBe(feature);
  });

  it("counts every item's page as one feature", () => {
    expect(featureOf({ event: "item", productionId: "2027", itemId: "made-up-item" })).toBe(
      "item-page",
    );
  });

  it("names the export made", () => {
    expect(featureOf({ event: "export", export: "excel-grid" })).toBe("export-excel-grid");
  });

  it("names no feature for a session, which isn't a use", () => {
    expect(featureOf({ event: "session" })).toBeUndefined();
  });
});

describe("UsageSummary", () => {
  it("holds when recording started and each person's sessions and uses", () => {
    const summary = {
      recordedSince: "2026-10-24T09:00:00.000Z",
      people: [
        {
          username: "robin",
          sessions: 2,
          lastSession: "2026-10-20T19:00:00.000Z",
          uses: { "running-order": 3, cast: 1 },
        },
      ],
      features: [{ feature: "running-order", uses: 3, people: 1 }],
      activity: [
        { username: "robin", at: "2026-10-20T19:01:00.000Z", event: "page", page: "running-order" },
        { username: "robin", at: "2026-10-20T19:00:00.000Z", event: "session" },
      ],
    };
    expect(UsageSummary.parse(summary)).toEqual(summary);
  });

  it("holds someone with uses but no session in the period", () => {
    const person = { username: "robin", sessions: 0, lastSession: null, uses: { cast: 1 } };
    expect(
      UsageSummary.parse({ recordedSince: null, people: [person], features: [], activity: [] })
        .people,
    ).toEqual([person]);
  });

  it("refuses a use of something that isn't recorded", () => {
    const person = { username: "robin", sessions: 0, lastSession: null, uses: { secrets: 1 } };
    expect(
      UsageSummary.safeParse({ recordedSince: null, people: [person], features: [], activity: [] })
        .success,
    ).toBe(false);
  });

  it("refuses a total of something that isn't recorded", () => {
    const features = [{ feature: "secrets", uses: 1, people: 1 }];
    expect(UsageSummary.safeParse({ recordedSince: null, people: [], features }).success).toBe(
      false,
    );
  });

  it("says nothing has been recorded yet with no start date", () => {
    expect(
      UsageSummary.parse({ recordedSince: null, people: [], features: [], activity: [] })
        .recordedSince,
    ).toBeNull();
  });
});

describe("UsageQuery", () => {
  it.each([7, 30, 90])("accepts the last %i days", (days) => {
    expect(UsageQuery.parse({ days: String(days) })).toEqual({ days });
  });

  it("covers the last 30 days when no range is given", () => {
    expect(UsageQuery.parse({})).toEqual({ days: 30 });
  });

  it.each(["365", "0", "-7", "7.5", "seven", ""])("refuses %j days", (days) => {
    expect(UsageQuery.safeParse({ days }).success).toBe(false);
  });
});
