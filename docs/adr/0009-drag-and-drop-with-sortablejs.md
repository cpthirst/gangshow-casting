# 0009. Drag and drop with SortableJS, used directly

- **Status**: Accepted
- **Date**: 2026-10-10
- **Deciders**: Nick Hirst

## Context

The running order needs drag-and-drop reordering, within a half and across the interval (running-order.E2.S2, PRD FR4). The production team often uses phones and tablets at rehearsal, so dragging must work with touch. Native HTML5 drag and drop doesn't support touch. Keyboard and single-pointer users already have move buttons (E2.S1, WCAG 2.5.7).

Rows on the page are derived from the working copy of the running order, through the running clock. A drop must become the same kind of unsaved change as a move button, not edit a list in place.

## Options considered

1. **Native HTML5 drag and drop**: no dependency, but no touch support, and awkward feedback while dragging.
2. **`vue-draggable-plus`** (a Vue wrapper around SortableJS): idiomatic, and keeps an array in sync with the DOM. That two-way binding doesn't fit rows derived from a computed clock, and it adds a second dependency for a feature we wouldn't use.
3. **SortableJS directly** (`sortablejs`): mature and widely used. It supports touch and dragging between lists, with no install scripts. We need a small Vue directive (about 30 lines) that turns SortableJS's drop event into a "move this item to that half and position" call, and puts the DOM back so Vue stays in charge of rendering.

## Decision

We will use **SortableJS directly** (`sortablejs`, with `@types/sortablejs` for development), through a `v-sortable-rows` directive in `apps/web`. A drop calls a pure `dropItem` function, so drags and move buttons share one path to unsaved changes, Save and Reset.

## Consequences

- **Easier**: the drop logic is a plain function with unit tests. Page tests drive the directive by mocking SortableJS's drop event. One runtime dependency.
- **Harder**: the directive must undo SortableJS's own DOM move before Vue re-renders. Real touch dragging can only be checked by hand on a device.
- **Revisit if**: we need features like multi-drag or nested lists, or the directive grows beyond simple glue. Then reconsider `vue-draggable-plus`.
