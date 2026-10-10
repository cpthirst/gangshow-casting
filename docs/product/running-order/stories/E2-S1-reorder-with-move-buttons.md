---
id: running-order.E2.S1
title: Reorder items with move buttons, then save as a new draft or reset
epic: E2
status: in-progress
---

## Story

As a member of the production team in a casting meeting, I want to try moving items up, down or into the other half, then save the result as the next draft or reset it, so that we can fix a costume-change clash without editing and recirculating a document, and without a new version for every experiment.

## Acceptance criteria

### AC1: Moving an item down is an unsaved change
Given the first half is "Curtain Up", "Pirate Panic", "Dance One" at Draft 6
When I press "Move down" on "Curtain Up"
Then the first half reads "Pirate Panic", "Curtain Up", "Dance One"
And the numbering updates to match the new order
And I still see "Draft 6" with "Unsaved changes"

### AC2: Moving an item up
Given the first half is "Curtain Up", "Pirate Panic", "Dance One"
When I press "Move up" on "Dance One"
Then the first half reads "Curtain Up", "Dance One", "Pirate Panic"

### AC3: Moving an item into the other half
Given "Dance One" is the last item of the first half
When I press "Move to second half" on "Dance One"
Then "Dance One" is the first item of the second half
And it's no longer in the first half

### AC4: Moves that would leave the half aren't offered
Given "Curtain Up" is the first item of the first half and "Big Finish" is the last item of the second half
When I look at their move buttons
Then "Move up" on "Curtain Up" and "Move down" on "Big Finish" are unavailable

### AC5: Saving makes the next draft
Given I've moved "Curtain Up" down on Draft 6
When I press "Save as Draft 7"
Then I see "Draft 7" with no unsaved changes
And the new order is kept

### AC6: Reset discards unsaved changes
Given I've moved "Curtain Up" down and "Big Finish" to the first half on Draft 6
When I press "Reset"
Then the order is Draft 6's as saved
And there are no unsaved changes

### AC7: Save and Reset need something to save
Given I have no unsaved changes, or I moved an item and then moved it back
When I look at "Save as Draft 7" and "Reset"
Then both are unavailable

### AC8: A saved draft survives a reload
Given I saved the new order as Draft 7
When I reload the Running order page
Then I see the new order and "Draft 7"

### AC9: Someone else's newer draft isn't overwritten
Given I opened the running order at Draft 6 and moved "Curtain Up" down
And someone else has since saved Draft 7
When I press "Save as Draft 7"
Then my changes aren't saved
And I see "Someone else saved a newer draft. Showing the latest (Draft 7). Your unsaved changes were discarded."
And the page shows Draft 7's order

### AC10: Leaving with unsaved changes asks first
Given I have unsaved changes
When I choose another page from the menu
Then I'm asked "Discard unsaved changes?"
And if I cancel, I stay on the Running order page with my changes

### AC11: Moves are announced and focus stays with the item
Given I'm using a keyboard or screen reader
When I press "Move down" on "Curtain Up"
Then I hear "Curtain Up moved to position 2. Not saved yet."
And focus stays on a move button of "Curtain Up"

### AC12: The API saves a reorder as the next version and keeps the old one
Given version 6 is the latest
When a client sends a reorder of version 6's items with base version 6
Then the response is 201 with version 7 in the new order
And version 6 is still stored unchanged

### AC13: The API rejects a stale base version
Given version 7 is the latest
When a client sends a reorder with base version 6
Then the response is 409 and nothing is saved

### AC14: The API rejects a reorder that loses, duplicates or invents items
Given version 6 holds items A, B and C
When a client sends a reorder listing A, A and B, or A, B, C and D
Then the response is 400 and nothing is saved

## Notes

- FRs: FR5, FR6, FR7, FR8, FR11
- Depends on: running-order.E1.S1
- Changed 2026-10-10 (product owner): saving is explicit. Moves are unsaved changes in the browser; "Save as Draft N+1" sends the whole new order as one reorder, and "Reset" discards the unsaved changes. The first version of this story saved on every move.
- Unsaved changes also cover the browser's refresh or close (the browser's own "leave site?" prompt).
- The API change is described in `packages/shared`. `POST /api/productions/:id/running-order/versions` with `{ baseVersion, change }`, where this story's change is `{ type: "reorder", halves: [{ id, itemIds }] }`.
- Out of scope: drag and drop (E2.S2), and a version history screen.
