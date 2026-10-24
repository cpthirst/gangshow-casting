import type { RunningOrder, RunningOrderItem } from "@app/shared";

// Made-up data only: tests never use the real programme (CLAUDE.md safeguarding).

/** "Pirate Sketch" → id "pirate-sketch". */
export const anItem = (
  title: string,
  details: Partial<RunningOrderItem> = {},
): RunningOrderItem => ({
  id: title.toLowerCase().replaceAll(" ", "-"),
  title,
  cast: "",
  stage: ["full"],
  leads: "",
  comments: "",
  minutes: 5,
  printed: true,
  ...details,
});

export const aRunningOrder = (
  first: RunningOrderItem[],
  second: RunningOrderItem[] = [],
  version = 7,
): RunningOrder => ({
  productionId: "2027",
  title: "Gang Show 2027",
  version,
  savedAt: "2026-10-04T00:00:00.000Z",
  startTime: "19:15",
  intervalMinutes: 20,
  halves: [
    { id: "first-half", name: "First half", items: first },
    { id: "second-half", name: "Second half", items: second },
  ],
});
