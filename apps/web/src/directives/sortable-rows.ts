import Sortable from "sortablejs";
import type { Directive } from "vue";

/** Where a dragged row was dropped: which half (0 or 1) and its final position there. */
export interface RowDrop {
  itemId: string;
  toHalf: 0 | 1;
  toIndex: number;
}

export interface SortableRowsBinding {
  onDrop: (drop: RowDrop) => void;
  disabled: boolean;
}

// The latest binding per list, so drops always reach the current handler.
const bindings = new WeakMap<HTMLElement, SortableRowsBinding>();

/**
 * Makes a <tbody> of running order rows draggable, between both halves (ADR 0009).
 * Rows need `data-item-id`; the tbody needs `data-half` ("0" or "1").
 */
export const vSortableRows: Directive<HTMLElement, SortableRowsBinding> = {
  mounted(el, { value }) {
    bindings.set(el, value);
    Sortable.create(el, {
      group: "running-order",
      handle: ".drag-handle",
      // Only item rows move; an empty half's "No items" row is just a drop target.
      draggable: "[data-item-id]",
      animation: 150,
      disabled: value.disabled,
      onEnd({ item, from, to, oldIndex, newIndex }) {
        const itemId = item.dataset.itemId;
        if (itemId === undefined || oldIndex === undefined || newIndex === undefined) return;
        // Vue renders rows from the working order: undo SortableJS's own DOM move, then
        // report the drop so the order changes and Vue re-renders it. Remove first, so
        // children[oldIndex] is the row that originally followed this one.
        item.remove();
        from.insertBefore(item, from.children[oldIndex] ?? null);
        bindings
          .get(el)
          ?.onDrop({ itemId, toHalf: to.dataset.half === "1" ? 1 : 0, toIndex: newIndex });
      },
    });
  },
  updated(el, { value }) {
    bindings.set(el, value);
    Sortable.get(el)?.option("disabled", value.disabled);
  },
  unmounted(el) {
    Sortable.get(el)?.destroy();
    bindings.delete(el);
  },
};
