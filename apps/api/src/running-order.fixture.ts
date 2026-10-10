import type { RunningOrder, RunningOrderItem } from "@app/shared";

// Made-up data only: tests never use the real programme (CLAUDE.md safeguarding).

export const itemId = (title: string) => `itm_${title.toLowerCase().replaceAll(" ", "-")}`;

export const anItem = (title: string): RunningOrderItem => ({
  id: itemId(title),
  title,
  cast: "Full Senior Gang",
  stage: ["full"],
  leads: "Sam / Alex",
  comments: "",
  minutes: 5,
  printed: true,
});

export function aRunningOrder(
  version: number,
  { first = ["Curtain Up"], second = [] as string[], productionId = "2027" } = {},
): RunningOrder {
  return {
    productionId,
    title: "Gang Show 2027",
    version,
    savedAt: "2026-10-04T00:00:00.000Z",
    startTime: "19:15",
    intervalMinutes: 20,
    halves: [
      { id: "first-half", name: "First half", items: first.map(anItem) },
      { id: "second-half", name: "Second half", items: second.map(anItem) },
    ],
  };
}
