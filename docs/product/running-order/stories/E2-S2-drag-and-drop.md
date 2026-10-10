---
id: running-order.E2.S2
title: Reorder items by drag and drop
epic: E2
status: done
---

## Story

As a member of the production team in a casting meeting, I want to drag an item to a new place in the running order, so that trying out a different order is as quick as pointing at it.

## Acceptance criteria

### AC1: Dragging within a half is an unsaved change
Given the first half is "Curtain Up", "Pirate Panic", "Dance One" at Draft 6
When I drag "Dance One" above "Curtain Up"
Then the first half reads "Dance One", "Curtain Up", "Pirate Panic"
And I see "Unsaved changes", ready to save as Draft 7

### AC2: Dragging across the interval
Given "Big Finish" is in the second half
When I drag "Big Finish" into the first half between "Curtain Up" and "Pirate Panic"
Then the first half reads "Curtain Up", "Big Finish", "Pirate Panic"
And "Big Finish" is no longer in the second half

### AC3: Dropping an item where it started changes nothing
Given the running order is at Draft 6 with no unsaved changes
When I drag "Pirate Panic" and drop it back in its original place
Then there are still no unsaved changes

### AC4: Each row has a labelled drag handle
Given I'm on the Running order page
When I look at the "Pirate Panic" row
Then it has a drag handle labelled "Drag Pirate Panic"
And the move buttons from E2.S1 are still available

### AC5: Dragged changes save and reset like moves
Given I've dragged items into a new order
When I press "Save as Draft 7", or "Reset"
Then the order is saved as Draft 7, or put back to Draft 6, as with the move buttons

## Notes

- FRs: FR4
- Depends on: running-order.E2.S1. Drags make the same unsaved changes as the move buttons, and use the same Save and Reset.
- New dependency: SortableJS, used directly ([ADR 0009](../../../adr/0009-drag-and-drop-with-sortablejs.md)).
- Touch dragging on a real phone is checked by hand. Tests drive the list's change events.
- Out of scope: dragging several items at once.
