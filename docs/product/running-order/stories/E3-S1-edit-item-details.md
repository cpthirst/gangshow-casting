---
id: running-order.E3.S1
title: Edit an item's details
epic: E3
status: in-progress
---

## Story

As a member of the production team, I want to correct an item's details in place, so that the running order stays the single, current source of truth.

## Acceptance criteria

### AC1: An edit is an unsaved change until the draft is saved
Given "Pirate Panic" has 18 minutes at Draft 6
When I edit "Pirate Panic", change its minutes to 20 and apply the edit
Then its row shows "20" and I see "Unsaved changes"
And pressing "Save as Draft 7" saves it

### AC2: Every detail can be edited
Given I'm editing "Pirate Panic"
When I change its title, cast, stage (to Full then Apron), leads, comments, minutes and printed setting, then save
Then the row shows every new value

### AC3: An item can be left untimed
Given I'm editing "Pirate Panic"
When I clear its minutes and save
Then its row shows it as having no timing

### AC4: Invalid details aren't saved
Given I'm editing "Pirate Panic"
When I clear the title, or enter minutes of "-3" or "ten", and apply the edit
Then I see what needs fixing next to the field
And the item is unchanged

### AC5: Cancelling leaves the item unchanged
Given I'm editing "Pirate Panic" and have changed its title
When I cancel
Then the row shows the original title
And the edit isn't an unsaved change

### AC6: Unprinting an item renumbers the half
Given "Pirate Panic" is numbered 2 and "Dance One" is numbered 3
When I edit "Pirate Panic", mark it as not printed and save
Then "Pirate Panic" is marked "Not in printed programme" and has no number
And "Dance One" is numbered 2

### AC7: Reset discards unsaved edits
Given I've edited "Pirate Panic" without saving the draft
When I press "Reset"
Then "Pirate Panic" shows its saved details

### AC8: The API validates edits
Given version 6 is the latest
When a client sends an edit with an empty title, negative minutes or an unknown item id
Then the response is 400 and nothing is saved

## Notes

- FRs: FR6, FR7, FR9
- Depends on: running-order.E2.S1. Edits are unsaved changes alongside moves, saved by the same "Save as Draft N+1" and discarded by "Reset".
- The save request carries moves and edits together: an `update` change with both halves' items in their new order and with their details, replacing E2.S1's `reorder`. The server checks it's the same set of items (FR8) and validates every field with the shared schema.
- Stage is chosen from a list of the sequences in use (Apron, Full, Apron / Full, Full / Apron, Apron / Full / Apron, Full / Apron / Full); an item's current value is always offered.
- One item is edited at a time; moves, drags, Save and Reset wait until the edit is applied or cancelled.
- Text limits are set in the shared schema. For example, title up to 120 characters and other text up to 500.
- Out of scope: adding and removing items (E3.S2, dropped for now), and editing the start time or interval.
