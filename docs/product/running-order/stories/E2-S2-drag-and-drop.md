---
id: running-order.E2.S2
title: Reorder items by drag and drop
epic: E2
status: ready
---

## Story

As a member of the production team in a casting meeting, I want to drag an item to a new place in the running order, so that trying out a different order is as quick as pointing at it.

## Acceptance criteria

### AC1: Dragging within a half saves a new version
Given the first half is "Curtain Up", "Pirate Panic", "Dance One" at version 6
When I drag "Dance One" above "Curtain Up"
Then the first half reads "Dance One", "Curtain Up", "Pirate Panic"
And I see "Draft 7"

### AC2: Dragging across the interval
Given "Big Finish" is in the second half
When I drag "Big Finish" into the first half between "Curtain Up" and "Pirate Panic"
Then the first half reads "Curtain Up", "Big Finish", "Pirate Panic"
And "Big Finish" is no longer in the second half

### AC3: Dropping an item where it started saves nothing
Given the running order is at version 6
When I drag "Pirate Panic" and drop it back in its original place
Then I still see "Draft 6"

### AC4: Each row has a labelled drag handle
Given I'm on the Running order page
When I look at the "Pirate Panic" row
Then it has a drag handle labelled "Drag Pirate Panic"
And the move buttons from E2.S1 are still available

### AC5: A rejected drag puts the order back
Given someone else has saved a newer version
When I drag an item to a new place
Then my drag isn't kept
And I see the latest version with the "Someone else changed the running order" message

## Notes

- FRs: FR4
- Depends on: running-order.E2.S1. It reuses the same save, versioning and conflict path.
- New dependency: a touch-capable sortable library (`vue-draggable-plus` / SortableJS is expected), recorded in an ADR in this story.
- Touch dragging on a real phone is checked by hand. Tests drive the list's change events.
- Out of scope: dragging several items at once.
