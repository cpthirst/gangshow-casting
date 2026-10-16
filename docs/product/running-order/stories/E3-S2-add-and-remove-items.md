---
id: running-order.E3.S2
title: Add and remove items
epic: E3
status: draft
---

## Story

As a member of the production team, I want to add a new item or drop one from the show, so that the running order keeps up as items are confirmed or cut.

## Acceptance criteria

### AC1: Adding an item to a half
Given the second half ends with "Big Finish" at version 6
When I add an item titled "Encore" to the second half
Then "Encore" appears at the end of the second half
And I see "Unsaved changes", ready to save as Draft 7

### AC2: A new item needs a title
Given I'm adding an item
When I try to add it without a title
Then I see that a title is required
And nothing is added

### AC3: Removing an item asks first
Given "Dance One" is in the first half
When I choose "Remove" on "Dance One"
Then I'm asked to confirm removing "Dance One"

### AC4: Confirming removal is an unsaved change
Given I've been asked to confirm removing "Dance One" at Draft 6
When I confirm
Then "Dance One" is no longer in the running order
And I see "Unsaved changes"

### AC5: Cancelling removal keeps the item
Given I've been asked to confirm removing "Dance One"
When I cancel
Then "Dance One" is still in the running order
And there are no unsaved changes

### AC6: An empty half is shown as empty
Given the second half has one item
When I remove it
Then the second half shows "No items"
And the interval and the half's total of 0 minutes are still shown

### AC7: The API accepts a saved draft with items added and removed
Given version 6 holds items A, B and C
When a client saves a draft with base version 6 that removes B and adds a new item D
Then the response is 201 with version 7 holding A, C and D, and D has a stable id

## Notes

- Removing an item should also delete its casting notes (casting-item-overview FR8) and its roles, so nothing about a removed item is kept (agreed with the user on 2026-10-16 during the item-notes review).

- **Dropped for now** (2026-10-10, product owner). Kept as a draft so the ID isn't reused. Revisit when items need adding or cutting in the app.
- FRs: FR6, FR10
- Depends on: running-order.E3.S1. This reuses its item form. Adds and removals are unsaved changes, saved or reset with everything else.
- New items get a server-generated stable id.
- Out of scope: restoring a removed item, other than by adding it again or from a stored version.
