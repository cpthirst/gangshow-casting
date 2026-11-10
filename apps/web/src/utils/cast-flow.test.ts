import { describe, expect, it } from "vitest";
import { type CastFlowPlace, castFlowOf, shortMark } from "./cast-flow.ts";
import { aCastMember, aRole, ids } from "./casting.fixture.ts";
import { anItem, aRunningOrder } from "./running-order.fixture.ts";

const at = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

// The made-up 2027 show: curtain up at 19:00, a 20-minute interval, and 50 on the cast list.
const order = {
  ...aRunningOrder(
    [anItem("Opening", { minutes: 10 }), anItem("Campfire Sketch", { minutes: null })],
    [anItem("Finale", { minutes: 8 })],
  ),
  startTime: "19:00",
};
const roles = [
  aRole(1, "opening", ids(1, 30)),
  // Alex Example, member 1, plays the lead and is in the ensemble too.
  aRole(2, "campfire-sketch", [1], { size: "lead" }),
  aRole(3, "campfire-sketch", ids(1, 5)),
  aRole(4, "finale", ids(1, 40)),
];
const cast = ids(1, 50).map((id) => aCastMember(id));

/** The count in a place at a time: the latest point at or before it, as the graph steps. */
function countAt(flow: ReturnType<typeof castFlowOf>, time: string, place: CastFlowPlace) {
  const point = flow.points.findLast(({ at: start }) => start <= at(time));
  return point?.counts[place];
}

describe("castFlowOf", () => {
  const flow = castFlowOf(order, roles, cast);

  it("puts everyone cast in the running item On-stage", () => {
    expect(countAt(flow, "19:00", "on-stage")).toBe(30);
    expect(countAt(flow, "19:09", "on-stage")).toBe(30);
  });

  it("puts everyone else on the cast list, including those cast in nothing, in the Dressing Room", () => {
    expect(countAt(flow, "19:00", "dressing-room")).toBe(20);
    for (const { counts } of flow.points) {
      expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(50);
    }
  });

  it("counts someone in two roles of one item once", () => {
    expect(countAt(flow, "19:10", "on-stage")).toBe(5);
  });

  it("gives an untimed item 5 minutes, then the interval, then the second half", () => {
    expect(countAt(flow, "19:14", "on-stage")).toBe(5);
    expect(countAt(flow, "19:15", "on-stage")).toBe(0);
    expect(countAt(flow, "19:34", "on-stage")).toBe(0);
    expect(countAt(flow, "19:35", "on-stage")).toBe(40);
  });

  it("runs to the end of the last item, with everyone back in the Dressing Room", () => {
    expect(flow.points.at(-1)).toEqual({
      at: at("19:43"),
      counts: { "on-stage": 0, standby: 0, backstage: 0, "dressing-room": 50 },
    });
  });

  it("marks each item's start with its number in its half and its name, and the interval's", () => {
    expect(flow.marks).toEqual([
      { at: at("19:00"), label: "1 Opening" },
      { at: at("19:10"), label: "2 Campfire Sketch" },
      { at: at("19:15"), label: "Interval" },
      { at: at("19:35"), label: "1 Finale" },
    ]);
  });

  it("marks an item that isn't in the printed programme by its title", () => {
    const withSong = aRunningOrder([
      anItem("Opening"),
      anItem("Scene Change Song", { printed: false }),
      anItem("Campfire Sketch"),
    ]);

    const labels = castFlowOf(withSong, [], cast).marks.map(({ label }) => label);

    expect(labels).toEqual(["1 Opening", "Scene Change Song", "2 Campfire Sketch", "Interval"]);
  });

  it("joins the marks of things that start at once, such as after a 0-minute item", () => {
    const quick = aRunningOrder([anItem("Opening", { minutes: 0 }), anItem("Campfire Sketch")]);

    expect(castFlowOf(quick, [], cast).marks[0]).toEqual({
      at: at("19:15"),
      label: "1 Opening, 2 Campfire Sketch",
    });
  });

  it("leaves out anyone cast who is no longer on the cast list", () => {
    const flowOf10 = castFlowOf(
      order,
      roles,
      ids(1, 10).map((id) => aCastMember(id)),
    );

    expect(countAt(flowOf10, "19:00", "on-stage")).toBe(10);
    expect(countAt(flowOf10, "19:00", "dressing-room")).toBe(0);
  });
});

describe("castFlowOf, calling the cast before their items", () => {
  // Curtain up at 19:00 and 60 on the cast list. Opening 19:00–19:10 (members 1–30), then
  // Campfire Sketch 19:10–19:15 (Sam 1 and Jo 2 from Opening, and 31–32), then Gang Song
  // 19:15–19:25 (33–44, and Robin 3 from Opening). Finale 19:45–19:53 (1–40) after the interval.
  const calledShow = {
    ...aRunningOrder(
      [
        anItem("Opening", { minutes: 10 }),
        anItem("Campfire Sketch", { minutes: 5 }),
        anItem("Gang Song", { minutes: 10 }),
      ],
      [anItem("Finale", { minutes: 8 })],
    ),
    startTime: "19:00",
  };
  const calledRoles = [
    aRole(1, "opening", ids(1, 30)),
    aRole(2, "campfire-sketch", [1, 2, 31, 32]),
    aRole(3, "gang-song", [3, ...ids(33, 44)]),
    aRole(4, "finale", ids(1, 40)),
  ];
  const flow = castFlowOf(
    calledShow,
    calledRoles,
    ids(1, 60).map((id) => aCastMember(id)),
  );

  it("calls the cast Backstage 6 minutes before their item", () => {
    expect(countAt(flow, "19:09", "backstage")).toBe(12);
    expect(countAt(flow, "19:11", "backstage")).toBe(0);
  });

  it("calls them to Standby 4 minutes before their item", () => {
    expect(countAt(flow, "19:11", "standby")).toBe(13);
    expect(countAt(flow, "19:14", "standby")).toBe(13);
    expect(countAt(flow, "19:15", "standby")).toBe(0);
  });

  it("starts at the first call before curtain up", () => {
    expect(flow.points[0]?.at).toBe(at("18:54"));
    expect(countAt(flow, "18:54", "backstage")).toBe(30);
    expect(countAt(flow, "18:56", "standby")).toBe(30);
    expect(countAt(flow, "18:56", "backstage")).toBe(0);
  });

  it("keeps on stage anyone called for the next item while they're on", () => {
    // Only Campfire Sketch's two not in Opening answer its calls; Sam and Jo stay on.
    expect(countAt(flow, "19:04", "backstage")).toBe(2);
    expect(countAt(flow, "19:06", "standby")).toBe(2);
    expect(countAt(flow, "19:06", "on-stage")).toBe(30);
    // Then on again in Campfire Sketch, all four of its cast, straight from Opening.
    expect(countAt(flow, "19:10", "on-stage")).toBe(4);
  });

  it("takes someone coming off stage straight to their call, not the Dressing Room", () => {
    // Robin leaves Opening at 19:10 into Gang Song's Backstage call, then Standby at 19:11.
    expect(countAt(flow, "19:10", "backstage")).toBe(13);
    expect(countAt(flow, "19:10", "dressing-room")).toBe(60 - 4 - 13);
  });

  it("counts someone called for two items at once in Standby, nearer the stage", () => {
    const close = {
      ...aRunningOrder([anItem("Duet", { minutes: 3 }), anItem("Reprise", { minutes: 3 })]),
      startTime: "19:00",
    };
    const both = [aRole(1, "duet", [1]), aRole(2, "reprise", [1])];

    const closeFlow = castFlowOf(close, both, [aCastMember(1)]);

    // Reprise's Backstage call at 18:57 comes during the Duet's Standby call.
    expect(countAt(closeFlow, "18:57", "standby")).toBe(1);
    expect(countAt(closeFlow, "18:57", "backstage")).toBe(0);
  });

  it("calls the second half's first item during the interval", () => {
    expect(countAt(flow, "19:38", "backstage")).toBe(0);
    expect(countAt(flow, "19:39", "backstage")).toBe(40);
    expect(countAt(flow, "19:41", "standby")).toBe(40);
    expect(countAt(flow, "19:41", "backstage")).toBe(0);
    expect(countAt(flow, "19:45", "on-stage")).toBe(40);
  });

  it("always adds the four places up to the cast list", () => {
    for (const { counts } of flow.points) {
      expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(60);
    }
  });
});

describe("shortMark", () => {
  it("cuts a long mark label to 10 characters, ended with an ellipsis", () => {
    expect(shortMark("2 Campfire Sketch")).toBe("2 Campfire…");
    expect(shortMark("Scene Change Song")).toBe("Scene Chan…");
  });

  it("leaves a label that fits whole", () => {
    expect(shortMark("1 Opening")).toBe("1 Opening");
    expect(shortMark("Interval")).toBe("Interval");
    expect(shortMark("10 Finales")).toBe("10 Finales");
  });

  it("doesn't leave a space before the ellipsis", () => {
    expect(shortMark("4 The Big Show")).toBe("4 The Big…");
  });
});
