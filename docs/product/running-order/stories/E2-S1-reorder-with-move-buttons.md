---
id: running-order.E2.S1
title: Reorder items with move buttons, saving a new version
epic: E2
status: done
---

## Story

As a member of the production team in a casting meeting, I want to move an item up, down or into the other half and have it saved straight away, so that we can fix a costume-change clash without editing and recirculating a document.

## Acceptance criteria

### AC1: Moving an item down saves a new version
Given the first half is "Curtain Up", "Pirate Panic", "Dance One" at version 6
When I press "Move down" on "Curtain Up"
Then the first half reads "Pirate Panic", "Curtain Up", "Dance One"
And I see "Draft 7"
And the numbering updates to match the new order

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

### AC5: A saved order survives a reload
Given I moved "Curtain Up" down and saw "Draft 7"
When I reload the Running order page
Then I see the new order and "Draft 7"

### AC6: Someone else's newer version isn't overwritten
Given I opened the running order at version 6
And someone else has since saved version 7
When I press "Move down" on "Curtain Up"
Then my move isn't applied
And I see "Someone else changed the running order. Showing the latest (Draft 7)."
And the page shows version 7's order

### AC7: Moves are announced and focus stays with the item
Given I'm using a keyboard or screen reader
When I press "Move down" on "Curtain Up"
Then I hear "Curtain Up moved to position 2. Saved as Draft 7."
And focus stays on a move button of "Curtain Up"

### AC8: The API saves a reorder as the next version and keeps the old one
Given version 6 is the latest
When a client sends a reorder of version 6's items with base version 6
Then the response is 201 with version 7 in the new order
And version 6 is still stored unchanged

### AC9: The API rejects a stale base version
Given version 7 is the latest
When a client sends a reorder with base version 6
Then the response is 409 and nothing is saved

### AC10: The API rejects a reorder that loses, duplicates or invents items
Given version 6 holds items A, B and C
When a client sends a reorder listing A, A and B, or A, B, C and D
Then the response is 400 and nothing is saved

## Notes

- FRs: FR5, FR6, FR7, FR8, FR11
- Depends on: running-order.E1.S1
- Every move saves straight away (PRD: autosave every change). The UI can show the move optimistically, but must show the server's result.
- The API change is described in `packages/shared` first. Suggested: `POST /api/productions/:id/running-order/versions` with `{ baseVersion, change }`, where this story's change is `{ type: "reorder", halves: [{ id, itemIds }] }`, so E3 can add other change types.
- Out of scope: drag and drop (E2.S2), and a version history screen.
