import type { RunningOrderItem, Stage } from "@app/shared";

/** Pairs items with their programme number: printed items count from 1; the rest get null. */
export function numberedItems(items: RunningOrderItem[]) {
  let next = 1;
  return items.map((item) => ({ item, number: item.printed ? next++ : null }));
}

const stageNames: Record<Stage, string> = { apron: "Apron", full: "Full" };

export const stageLabel = (stage: Stage[]) => stage.map((part) => stageNames[part]).join(" / ");
