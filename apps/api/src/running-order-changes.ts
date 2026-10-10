import type { ReorderChange, RunningOrder, RunningOrderChange } from "@app/shared";

export type ChangeResult = { ok: true; order: RunningOrder } | { ok: false; error: string };

/** Applies one change to the latest version. Versioning and saving are the caller's job. */
export function applyChange(latest: RunningOrder, change: RunningOrderChange): ChangeResult {
  switch (change.type) {
    case "reorder":
      return reorder(latest, change);
  }
}

// A reorder may move items anywhere, but must list every existing item exactly once.
function reorder(latest: RunningOrder, change: ReorderChange): ChangeResult {
  const byId = new Map(latest.halves.flatMap((half) => half.items).map((item) => [item.id, item]));
  const ids = change.halves.flatMap((half) => half.itemIds);
  const sameItems =
    ids.length === byId.size && new Set(ids).size === ids.length && ids.every((id) => byId.has(id));
  if (!sameItems) return { ok: false, error: "A reorder must list every item exactly once" };

  const itemsFor = (itemIds: string[]) => itemIds.flatMap((id) => byId.get(id) ?? []);
  const [first, second] = latest.halves;
  return {
    ok: true,
    order: {
      ...latest,
      halves: [
        { ...first, items: itemsFor(change.halves[0].itemIds) },
        { ...second, items: itemsFor(change.halves[1].itemIds) },
      ],
    },
  };
}
