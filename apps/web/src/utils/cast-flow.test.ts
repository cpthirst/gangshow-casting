import { describe, expect, it } from "vitest";
import { castFlowOf } from "./cast-flow.ts";
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
function countAt(
  flow: ReturnType<typeof castFlowOf>,
  time: string,
  place: "on-stage" | "dressing-room",
) {
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
      expect((counts["on-stage"] ?? 0) + (counts["dressing-room"] ?? 0)).toBe(50);
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

  it("runs from curtain up to the end of the last item", () => {
    expect(flow.points[0]?.at).toBe(at("19:00"));
    expect(flow.points.at(-1)).toEqual({
      at: at("19:43"),
      counts: { "on-stage": 0, "dressing-room": 50 },
    });
  });

  it("marks each item's start with its number in its half, and the interval's", () => {
    expect(flow.marks).toEqual([
      { at: at("19:00"), label: "1" },
      { at: at("19:10"), label: "2" },
      { at: at("19:15"), label: "Interval" },
      { at: at("19:35"), label: "1" },
    ]);
  });

  it("marks an item that isn't in the printed programme by its title", () => {
    const withSong = aRunningOrder([
      anItem("Opening"),
      anItem("Scene Change Song", { printed: false }),
      anItem("Campfire Sketch"),
    ]);

    const labels = castFlowOf(withSong, [], cast).marks.map(({ label }) => label);

    expect(labels).toEqual(["1", "Scene Change Song", "2", "Interval"]);
  });

  it("joins the marks of things that start at once, such as after a 0-minute item", () => {
    const quick = aRunningOrder([anItem("Opening", { minutes: 0 }), anItem("Campfire Sketch")]);

    expect(castFlowOf(quick, [], cast).marks[0]).toEqual({ at: at("19:15"), label: "1, 2" });
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
