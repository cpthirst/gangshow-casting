import type { CastMember, Role, RunningOrder } from "@app/shared";
import { runningClock } from "./running-order.ts";

/**
 * The places someone on the cast list can be during the show (production-cast-flow FR3),
 * nearest the stage first, each with its line's colour: at least 3:1 against the page.
 * Standby and Backstage join when their calls are worked out (E1.S3).
 */
export const CAST_FLOW_PLACES = [
  { id: "on-stage", name: "On-stage", colour: "#e22e12" },
  { id: "dressing-room", name: "Dressing Room", colour: "#6a3d9a" },
] as const;

export type CastFlowPlace = (typeof CAST_FLOW_PLACES)[number]["id"];

/** How long an item with no length set is taken to run, in minutes (FR8). */
export const UNTIMED_ITEM_MINUTES = 5;

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

/**
 * Who is where through the show (FR3, FR4, FR7, FR8), from the latest saved running order,
 * its roles and the cast list: a point wherever an item or the interval starts, and one at
 * the end. Someone in several roles of one item counts once, and anyone cast who is no
 * longer on the cast list not at all, so every point adds up to the cast list.
 */
export function castFlowOf(
  order: RunningOrder,
  roles: Role[],
  cast: CastMember[],
): { points: CastFlowPoint[]; marks: CastFlowMark[] } {
  const onCastList = new Set(cast.map(({ id }) => id));
  const onStageIn = (itemId: string) =>
    new Set(
      roles
        .filter((role) => role.itemId === itemId)
        .flatMap(({ castMemberIds }) => castMemberIds.filter((id) => onCastList.has(id))),
    ).size;
  const point = (at: number, onStage: number): CastFlowPoint => ({
    at,
    counts: { "on-stage": onStage, "dressing-room": cast.length - onStage },
  });

  const { halves, interval, finish } = runningClock(order, UNTIMED_ITEM_MINUTES);
  const intervalStart = { at: interval.startsAt, onStage: 0, label: "Interval" };
  // Each half's items, with the interval before the second.
  const starts = halves.flatMap(({ rows }, half) => [
    ...(half > 0 ? [intervalStart] : []),
    ...rows.map(({ item, number, startsAt }) => ({
      at: startsAt,
      onStage: onStageIn(item.id),
      label: number === null ? item.title : `${number} ${item.title}`,
    })),
  ]);
  return {
    points: [...starts.map(({ at, onStage }) => point(at, onStage)), point(finish, 0)],
    marks: joinedAtOnce(starts),
  };
}

/** One mark per moment: things that start at once, after a 0-minute item, share a label. */
function joinedAtOnce(marks: CastFlowMark[]): CastFlowMark[] {
  const byTime = new Map<number, string[]>();
  for (const { at, label } of marks) byTime.set(at, [...(byTime.get(at) ?? []), label]);
  return [...byTime].map(([at, labels]) => ({ at, label: labels.join(", ") }));
}
