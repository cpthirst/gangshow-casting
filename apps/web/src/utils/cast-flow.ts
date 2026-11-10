import type { CastMember, Role, RunningOrder } from "@app/shared";
import { runningClock } from "./running-order.ts";

/** How long an item with no length set is taken to run, in minutes (FR8). */
export const UNTIMED_ITEM_MINUTES = 5;

/** Minutes before their item the cast are called Backstage (FR5), the same for everyone. */
export const BACKSTAGE_CALL_MINUTES = 6;
/** Minutes before their item the cast go to Standby (FR5), the same for everyone. */
export const STANDBY_CALL_MINUTES = 4;

/**
 * The places someone on the cast list can be during the show (production-cast-flow FR3),
 * nearest the stage first, each with what it means (FR13), read by the graphs' headings and
 * Help, and its graph's colour: at least 3:1 against the page.
 */
export const CAST_FLOW_PLACES = [
  {
    id: "on-stage",
    name: "On-stage",
    description: "Performing in the item that's running.",
    colour: "#e22e12",
  },
  {
    id: "standby",
    name: "Standby",
    description: `In the wings, from ${STANDBY_CALL_MINUTES} minutes before their item.`,
    colour: "#8a5a00",
  },
  {
    id: "backstage",
    name: "Backstage",
    description: `In the holding area for props, mics and quick changes, from ${BACKSTAGE_CALL_MINUTES} minutes before their item.`,
    colour: "#1f5f8b",
  },
  {
    id: "dressing-room",
    name: "Dressing Room",
    description: "Everyone else on the cast list.",
    colour: "#6a3d9a",
  },
] as const;

export type CastFlowPlace = (typeof CAST_FLOW_PLACES)[number]["id"];

/** How many of the cast are in each place from a moment, in minutes after midnight, until
 *  the next point. */
export interface CastFlowPoint {
  at: number;
  counts: Record<CastFlowPlace, number>;
}

/** A start marked on the time axis: an item's number and title, or the interval (FR11). */
export interface CastFlowMark {
  at: number;
  label: string;
}

/** When one of someone's items runs. */
interface Appearance {
  starts: number;
  ends: number;
}

/**
 * Who is where through the show (FR3–FR8), from the latest saved running order, its roles
 * and the cast list: a point wherever an item starts or ends or a call comes, from the first
 * call to the end of the show. Someone in several roles of one item counts once, and anyone
 * cast who is no longer on the cast list not at all, so every point adds up to the cast list.
 */
export function castFlowOf(
  order: RunningOrder,
  roles: Role[],
  cast: CastMember[],
): { points: CastFlowPoint[]; marks: CastFlowMark[] } {
  const { halves, interval, finish } = runningClock(order, UNTIMED_ITEM_MINUTES);
  const items = halves.flatMap(({ rows, endsAt }) =>
    rows.map(({ item, startsAt }, row) => ({
      item,
      starts: startsAt,
      ends: rows[row + 1]?.startsAt ?? endsAt,
    })),
  );

  const appearances = new Map<number, Appearance[]>(cast.map(({ id }) => [id, []]));
  for (const shown of items) {
    const castIn = roles
      .filter(({ itemId }) => itemId === shown.item.id)
      .flatMap(({ castMemberIds }) => castMemberIds);
    for (const id of new Set(castIn)) appearances.get(id)?.push(shown);
  }

  // Where anyone is changes only when an item starts or ends, or a call comes.
  const changes = items.flatMap(({ starts, ends }) => [
    starts - BACKSTAGE_CALL_MINUTES,
    starts - STANDBY_CALL_MINUTES,
    starts,
    ends,
  ]);
  const times = [...new Set([...changes, interval.startsAt, finish])].sort((a, b) => a - b);
  const points = times.map((at) => {
    const counts = { "on-stage": 0, standby: 0, backstage: 0, "dressing-room": 0 };
    for (const shows of appearances.values()) counts[placeAt(shows, at)] += 1;
    return { at, counts };
  });

  const intervalMark = { at: interval.startsAt, label: "Interval" };
  // Each half's items, with the interval before the second.
  const marks = halves.flatMap(({ rows }, half) => [
    ...(half > 0 ? [intervalMark] : []),
    ...rows.map(({ item, number, startsAt }) => ({
      at: startsAt,
      label: number === null ? item.title : `${number} ${item.title}`,
    })),
  ]);
  return { points, marks: joinedAtOnce(marks) };
}

/** Where someone is at a moment: the place nearest the stage that any of their items puts
 *  them in, so coming off stage into a call goes straight to it (FR6). */
function placeAt(appearances: Appearance[], at: number): CastFlowPlace {
  const calledFrom = (minutes: number) =>
    appearances.some(({ starts }) => starts - minutes <= at && at < starts);
  if (appearances.some(({ starts, ends }) => starts <= at && at < ends)) return "on-stage";
  if (calledFrom(STANDBY_CALL_MINUTES)) return "standby";
  if (calledFrom(BACKSTAGE_CALL_MINUTES)) return "backstage";
  return "dressing-room";
}

/** One mark per moment: things that start at once, after a 0-minute item, share a label. */
function joinedAtOnce(marks: CastFlowMark[]): CastFlowMark[] {
  const byTime = new Map<number, string[]>();
  for (const { at, label } of marks) byTime.set(at, [...(byTime.get(at) ?? []), label]);
  return [...byTime].map(([at, labels]) => ({ at, label: labels.join(", ") }));
}

/** The most characters of a mark's label shown on a graph; longer ones are cut, ending "…". */
const SHORT_MARK_LENGTH = 10;

/** A mark's label as a graph shows it: whole if it fits, otherwise cut short with "…". */
export function shortMark(label: string) {
  if (label.length <= SHORT_MARK_LENGTH) return label;
  return `${label.slice(0, SHORT_MARK_LENGTH).trimEnd()}…`;
}
