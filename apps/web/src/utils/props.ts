import type { Prop } from "@app/shared";

// Only one production for now (see docs/product/running-order/prd.md).
const PRODUCTION_ID = "2027";

/** Every prop in the production (stage-props FR13). */
export const PROPS_PATH = `/api/productions/${PRODUCTION_ID}/props`;

/** How many props each item has, by item id: 0 for an item with none. */
export function propCounts(props: readonly Prop[]) {
  const counts = new Map<string, number>();
  for (const { itemId } of props) counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
  return (itemId: string) => counts.get(itemId) ?? 0;
}

/** A count with its label, so it never reads as a bare number: "1 prop", "3 props". */
export const propCountLabel = (count: number) => `${count} prop${count === 1 ? "" : "s"}`;
