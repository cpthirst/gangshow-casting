import type { RunningOrder } from "@app/shared";

// Made-up data only: tests never use the real programme (CLAUDE.md safeguarding).
export function aRunningOrder(version: number, productionId = "2027"): RunningOrder {
  return {
    productionId,
    title: "Gang Show 2027",
    version,
    savedAt: "2026-10-04T00:00:00.000Z",
    startTime: "19:15",
    intervalMinutes: 20,
    halves: [
      {
        id: "first-half",
        name: "First half",
        items: [
          {
            id: "itm_curtain-up",
            title: "Curtain Up",
            cast: "Full Senior Gang",
            stage: ["full"],
            leads: "Sam / Alex",
            comments: "",
            minutes: 5,
            printed: true,
          },
        ],
      },
      { id: "second-half", name: "Second half", items: [] },
    ],
  };
}
