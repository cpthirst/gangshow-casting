import { randomUUID } from "node:crypto";
import type {
  ChangeItem,
  RunningOrder,
  RunningOrderChange,
  RunningOrderItem,
  UpdateChange,
} from "@app/shared";

export type ChangeResult = { ok: true; order: RunningOrder } | { ok: false; error: string };

/** Applies one change to the latest version. Versioning and saving are the caller's job.
 *  `newId` names each added item. */
export function applyChange(
  latest: RunningOrder,
  change: RunningOrderChange,
  newId: () => string = randomUUID,
): ChangeResult {
  switch (change.type) {
    case "update":
      return update(latest, change, newId);
  }
}

// An update may move, edit, add and remove items (each field is already validated by the
// shared schema). Every item with an id must be one of the latest version's, at most once:
// an item left out is removed, and only items sent without an id are new (PRD FR8, FR10).
function update(latest: RunningOrder, change: UpdateChange, newId: () => string): ChangeResult {
  const existing = new Set(latest.halves.flatMap((half) => half.items).map((item) => item.id));
  const ids = change.halves
    .flatMap((half) => half.items)
    .flatMap((item) => ("id" in item ? [item.id] : []));
  const known = new Set(ids).size === ids.length && ids.every((id) => existing.has(id));
  if (!known) return { ok: false, error: "An update can't duplicate or invent an item" };

  const withIds = (items: ChangeItem[]): RunningOrderItem[] =>
    items.map((item) => ("id" in item ? item : { id: newId(), ...item }));
  const [first, second] = latest.halves;
  return {
    ok: true,
    order: {
      ...latest,
      halves: [
        { ...first, items: withIds(change.halves[0].items) },
        { ...second, items: withIds(change.halves[1].items) },
      ],
    },
  };
}
