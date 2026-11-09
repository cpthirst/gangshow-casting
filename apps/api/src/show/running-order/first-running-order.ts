import type { RunningOrder } from "@app/shared";

// Fixed defaults, chosen by the maintainer, because no page can change them yet.
const CURTAIN_UP = "19:15";
const INTERVAL_MINUTES = 20;

/**
 * The version a new production starts on: it has no items, and is what the Running order page
 * opens and what its first save builds on. Nothing comes from an earlier production.
 */
export const firstRunningOrder = (productionId: string, savedAt: string): RunningOrder => ({
  productionId,
  title: `Gang Show ${productionId}`,
  version: 1,
  savedAt,
  startTime: CURTAIN_UP,
  intervalMinutes: INTERVAL_MINUTES,
  halves: [
    { id: "first-half", name: "First half", items: [] },
    { id: "second-half", name: "Second half", items: [] },
  ],
});
