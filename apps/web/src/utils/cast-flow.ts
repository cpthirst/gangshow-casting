/**
 * The four places someone on the cast list can be during the show (production-cast-flow FR3),
 * nearest the stage first, each with its line's colour: at least 3:1 against the page.
 */
export const CAST_FLOW_PLACES = [
  { id: "on-stage", name: "On-stage", colour: "#e22e12" },
  { id: "standby", name: "Standby", colour: "#8a5a00" },
  { id: "backstage", name: "Backstage", colour: "#1f5f8b" },
  { id: "dressing-room", name: "Dressing Room", colour: "#6a3d9a" },
] as const;

export type CastFlowPlace = (typeof CAST_FLOW_PLACES)[number]["id"];

/** How many of the cast are in each place at one moment, in minutes after midnight. */
export interface CastFlowPoint {
  at: number;
  counts: Record<CastFlowPlace, number>;
}

const SAMPLE_CAST_SIZE = 60;
const clock = (hours: number, minutes: number) => hours * 60 + minutes;
// Everyone not On-stage, in Standby or Backstage is in the Dressing Room.
const point = (time: number, onStage: number, standby: number, backstage: number) => ({
  at: time,
  counts: {
    "on-stage": onStage,
    standby,
    backstage,
    "dressing-room": SAMPLE_CAST_SIZE - onStage - standby - backstage,
  },
});

// Made-up numbers, until the graph is worked out from the show (E1.S2).
export const SAMPLE_CAST_FLOW: CastFlowPoint[] = [
  point(clock(18, 54), 0, 0, 24),
  point(clock(18, 56), 0, 24, 8),
  point(clock(19, 0), 24, 8, 12),
  point(clock(19, 6), 24, 12, 6),
  point(clock(19, 10), 12, 6, 10),
  point(clock(19, 16), 12, 10, 4),
  point(clock(19, 20), 10, 4, 30),
  point(clock(19, 26), 10, 30, 0),
  point(clock(19, 30), 30, 0, 8),
  point(clock(19, 40), 30, 8, 0),
  point(clock(19, 45), 8, 0, 0),
  point(clock(19, 55), 0, 0, 0),
  point(clock(20, 9), 0, 0, 16),
  point(clock(20, 11), 0, 16, 6),
  point(clock(20, 15), 16, 6, 40),
  point(clock(20, 21), 16, 40, 0),
  point(clock(20, 25), 40, 0, 0),
  point(clock(20, 40), 0, 0, 0),
];
