import type { RunningOrder, RunningOrderChange, UpdateChange } from "@app/shared";

export type ChangeResult = { ok: true; order: RunningOrder } | { ok: false; error: string };

/** Applies one change to the latest version. Versioning and saving are the caller's job. */
export function applyChange(latest: RunningOrder, change: RunningOrderChange): ChangeResult {
  switch (change.type) {
    case "update":
      return update(latest, change);
  }
}

// An update may move and edit items (each field is already validated by the shared
// schema), but must hold exactly the latest version's items: none lost, duplicated or
// invented (PRD FR8).
function update(latest: RunningOrder, change: UpdateChange): ChangeResult {
  const existing = new Set(latest.halves.flatMap((half) => half.items).map((item) => item.id));
  const ids = change.halves.flatMap((half) => half.items).map((item) => item.id);
  const sameItems =
    ids.length === existing.size &&
    new Set(ids).size === ids.length &&
    ids.every((id) => existing.has(id));
  if (!sameItems) return { ok: false, error: "An update must hold every item exactly once" };

  const [first, second] = latest.halves;
  return {
    ok: true,
    order: {
      ...latest,
      halves: [
        { ...first, items: change.halves[0].items },
        { ...second, items: change.halves[1].items },
      ],
    },
  };
}
