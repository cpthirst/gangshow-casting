import { type RunningOrder, RunningOrderItem, type Stage, type UpdateChange } from "@app/shared";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** The production's running order: GET answers with the latest saved version. */
export const RUNNING_ORDER_PATH = `/api/productions/${PRODUCTION_ID}/running-order`;

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
  const first = [...order.halves[0].items];
  const second = [...order.halves[1].items];
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

/** The running order with one item dropped into a half (0 or 1) at a position there.
 *  The item is taken out first, so the position is its final place. */
export function dropItem(
  order: RunningOrder,
  itemId: string,
  toHalf: 0 | 1,
  toIndex: number,
): RunningOrder {
  const item = order.halves.flatMap((half) => half.items).find((i) => i.id === itemId);
  if (!item) return order;
  const without = (items: RunningOrderItem[]) => items.filter((i) => i.id !== itemId);
  const first = without(order.halves[0].items);
  const second = without(order.halves[1].items);
  (toHalf === 0 ? first : second).splice(toIndex, 0, item);
  return {
    ...order,
    halves: [
      { ...order.halves[0], items: first },
      { ...order.halves[1], items: second },
    ],
  };
}

/** The change that saves this order: every item, in place, with its details. */
export function updateOf(order: RunningOrder): UpdateChange {
  return {
    type: "update",
    halves: [
      { id: "first-half", items: order.halves[0].items },
      { id: "second-half", items: order.halves[1].items },
    ],
  };
}

// Field by field in a fixed order, so object key order never matters.
const contentOf = (order: RunningOrder) =>
  JSON.stringify(
    order.halves.map((half) =>
      half.items.map((i) => [
        i.id,
        i.title,
        i.cast,
        i.stage,
        i.leads,
        i.comments,
        i.minutes,
        i.printed,
      ]),
    ),
  );

/** True when both orders have the same items, in the same places, with the same details. */
export const sameContent = (a: RunningOrder, b: RunningOrder) => contentOf(a) === contentOf(b);

/** The edit form's fields, as typed. Stage is a label like "Apron / Full". */
export interface ItemForm {
  title: string;
  cast: string;
  stage: string;
  leads: string;
  comments: string;
  minutes: string;
  printed: boolean;
}

/** Stage sequences in use; the item being edited may add its own. */
export const STAGE_CHOICES = [
  "Apron",
  "Full",
  "Apron / Full",
  "Full / Apron",
  "Apron / Full / Apron",
  "Full / Apron / Full",
];

export const formFor = (item: RunningOrderItem): ItemForm => ({
  title: item.title,
  cast: item.cast,
  stage: stageLabel(item.stage),
  leads: item.leads,
  comments: item.comments,
  minutes: item.minutes === null ? "" : String(item.minutes),
  printed: item.printed,
});

// Every field that can fail validation (a checkbox can't).
const fieldMessages: Record<Exclude<keyof ItemForm, "printed">, string> = {
  title: "Enter a title (up to 120 characters).",
  cast: "Keep this to 500 characters or fewer.",
  stage: "Choose where on stage this happens.",
  leads: "Keep this to 500 characters or fewer.",
  comments: "Keep this to 500 characters or fewer.",
  minutes: "Enter whole minutes from 0 to 240, or leave it blank.",
};

const isFormField = (key: unknown): key is keyof typeof fieldMessages =>
  typeof key === "string" && key in fieldMessages;

export type ItemFormResult =
  | { ok: true; item: RunningOrderItem }
  | { ok: false; errors: Partial<Record<keyof ItemForm, string>> };

/** The item the form describes, or a friendly message for each field that needs fixing.
 *  Limits come from the shared schema, so the page and the API agree. */
export function itemFrom(form: ItemForm, id: string): ItemFormResult {
  const minutes = form.minutes.trim();
  const candidate = {
    id,
    title: form.title.trim(),
    cast: form.cast.trim(),
    // An empty label means no stage set yet.
    stage: form.stage.trim() === "" ? [] : form.stage.split("/").map((p) => p.trim().toLowerCase()),
    leads: form.leads.trim(),
    comments: form.comments.trim(),
    // Anything but whole digits fails the schema's integer check below.
    minutes: minutes === "" ? null : /^\d+$/.test(minutes) ? Number(minutes) : Number.NaN,
    printed: form.printed,
  };
  const parsed = RunningOrderItem.safeParse(candidate);
  if (parsed.success) return { ok: true, item: parsed.data };

  const errors: Partial<Record<keyof ItemForm, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (isFormField(field)) errors[field] = fieldMessages[field];
  }
  return { ok: false, errors };
}

/** The order with one item's details replaced, wherever it is. */
export function replaceItem(order: RunningOrder, edited: RunningOrderItem): RunningOrder {
  const replace = (items: RunningOrderItem[]) =>
    items.map((item) => (item.id === edited.id ? edited : item));
  return {
    ...order,
    halves: [
      { ...order.halves[0], items: replace(order.halves[0].items) },
      { ...order.halves[1], items: replace(order.halves[1].items) },
    ],
  };
}

/** The item, which half it's in and its 1-based position there. */
export function locate(order: RunningOrder, itemId: string) {
  for (const half of order.halves) {
    const index = half.items.findIndex((item) => item.id === itemId);
    const item = half.items[index];
    if (item) return { half, item, position: index + 1 };
  }
  return undefined;
}

/** An item with its half and programme number (null if it isn't printed), or undefined if
 *  it isn't in this running order. Unlike `locate`, which gives the row position for moves,
 *  this gives the printed-programme number. */
export function placeOf(order: RunningOrder, itemId: string) {
  for (const { half, rows } of runningClock(order).halves) {
    const row = rows.find(({ item }) => item.id === itemId);
    if (row) return { item: row.item, half, number: row.number };
  }
  return undefined;
}
