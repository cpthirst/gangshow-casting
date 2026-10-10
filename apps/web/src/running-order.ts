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

/** The reorder that one move makes, or undefined if the move would leave the item's half.
 *  Crossing the interval lands next to it: end of the first half, start of the second. */
export function planMove(
  order: RunningOrder,
  itemId: string,
  move: Move,
): ReorderChange | undefined {
  const first = order.halves[0].items.map((item) => item.id);
  const second = order.halves[1].items.map((item) => item.id);
  const inFirst = first.includes(itemId);
  const list = inFirst ? first : second;
  const index = list.indexOf(itemId);
  if (index === -1) return undefined;

  if (move === "other-half") {
    list.splice(index, 1);
    if (inFirst) second.unshift(itemId);
    else first.push(itemId);
  } else {
    const target = move === "up" ? index - 1 : index + 1;
    const neighbour = list[target];
    if (neighbour === undefined) return undefined;
    list[target] = itemId;
    list[index] = neighbour;
  }
  return {
    type: "reorder",
    halves: [
      { id: "first-half", itemIds: first },
      { id: "second-half", itemIds: second },
    ],
  };
}

/** Which half an item is in and its 1-based position there. */
export function locate(order: RunningOrder, itemId: string) {
  for (const half of order.halves) {
    const index = half.items.findIndex((item) => item.id === itemId);
    if (index !== -1) return { half, position: index + 1 };
  }
  return undefined;
}
