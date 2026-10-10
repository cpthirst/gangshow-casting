import type { ReorderChange, RunningOrder, RunningOrderItem, Stage } from "@app/shared";

const stageNames: Record<Stage, string> = { apron: "Apron", full: "Full" };

export const stageLabel = (stage: Stage[]) => stage.map((part) => stageNames[part]).join(" / ");

const MINUTES_PER_DAY = 24 * 60;

/** "19:15" → minutes after midnight. The shared schema guarantees the "HH:MM" shape. */
function minutesOf(time: string) {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** Minutes after midnight → UK 12-hour time, e.g. "7:15 pm". Wraps past midnight. */
export function formatTime(minutes: number) {
  const ofDay = minutes % MINUTES_PER_DAY;
  const hours = Math.floor(ofDay / 60);
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(ofDay % 60).padStart(2, "0")} ${hours < 12 ? "am" : "pm"}`;
}

/** Numbers and start times for one half, plus its total and end time.
 *  Printed items are numbered from 1; untimed items take no time. */
function timeHalf(items: RunningOrderItem[], startsAt: number) {
  let clock = startsAt;
  let nextNumber = 1;
  const rows = items.map((item) => {
    const row = { item, number: item.printed ? nextNumber++ : null, startsAt: clock };
    clock += item.minutes ?? 0;
    return row;
  });
  return { rows, totalMinutes: clock - startsAt, endsAt: clock };
}

/** Programme numbers and start times for the whole show, derived from one saved version. */
export function runningClock(order: RunningOrder) {
  const [first, second] = order.halves;
  const firstHalf = timeHalf(first.items, minutesOf(order.startTime));
  const interval = {
    startsAt: firstHalf.endsAt,
    endsAt: firstHalf.endsAt + order.intervalMinutes,
  };
  const secondHalf = timeHalf(second.items, interval.endsAt);
  return {
    halves: [
      { half: first, ...firstHalf },
      { half: second, ...secondHalf },
    ],
    interval,
    finish: secondHalf.endsAt,
  };
}

export type Move = "up" | "down" | "other-half";

/** The running order after one move, or undefined if the move would leave the item's half.
 *  Crossing the interval lands next to it: end of the first half, start of the second. */
export function moveItem(
  order: RunningOrder,
  itemId: string,
  move: Move,
): RunningOrder | undefined {
  const [first, second] = order.halves.map((half) => [...half.items]);
  if (!first || !second) return undefined;
  const inFirst = first.some((item) => item.id === itemId);
  const list = inFirst ? first : second;
  const index = list.findIndex((item) => item.id === itemId);
  const item = list[index];
  if (!item) return undefined;

  if (move === "other-half") {
    list.splice(index, 1);
    if (inFirst) second.unshift(item);
    else first.push(item);
  } else {
    const target = move === "up" ? index - 1 : index + 1;
    const neighbour = list[target];
    if (!neighbour) return undefined;
    list[target] = item;
    list[index] = neighbour;
  }
  return {
    ...order,
    halves: [
      { ...order.halves[0], items: first },
      { ...order.halves[1], items: second },
    ],
  };
}

/** The reorder change that saves this order's item positions. */
export function reorderOf(order: RunningOrder): ReorderChange {
  const ids = (index: 0 | 1) => order.halves[index].items.map((item) => item.id);
  return {
    type: "reorder",
    halves: [
      { id: "first-half", itemIds: ids(0) },
      { id: "second-half", itemIds: ids(1) },
    ],
  };
}

/** True when both orders have the same items in the same places. */
export const sameOrder = (a: RunningOrder, b: RunningOrder) =>
  JSON.stringify(reorderOf(a)) === JSON.stringify(reorderOf(b));

/** Which half an item is in and its 1-based position there. */
export function locate(order: RunningOrder, itemId: string) {
  for (const half of order.halves) {
    const index = half.items.findIndex((item) => item.id === itemId);
    if (index !== -1) return { half, position: index + 1 };
  }
  return undefined;
}
