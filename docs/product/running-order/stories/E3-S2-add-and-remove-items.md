---
id: running-order.E3.S2
title: Add and remove items
epic: E3
status: ready
---

## Story

As a member of the production team, I want to add a new item or drop one from the show, so that the running order keeps up as items are confirmed or cut.

## Acceptance criteria

### AC1: Adding an item to a half
Given the second half ends with "Big Finish" at version 6
When I add an item titled "Encore" to the second half and save
Then "Encore" appears at the end of the second half
And I see "Draft 7"

### AC2: A new item needs a title
Given I'm adding an item
When I save without a title
Then I see that a title is required
And no new version is saved

### AC3: Removing an item asks first
Given "Dance One" is in the first half
When I choose "Remove" on "Dance One"
Then I'm asked to confirm removing "Dance One"

### AC4: Confirming removal saves a new version
Given I've been asked to confirm removing "Dance One" at version 6
When I confirm
Then "Dance One" is no longer in the running order
And I see "Draft 7"

### AC5: Cancelling removal keeps the item
Given I've been asked to confirm removing "Dance One"
When I cancel
Then "Dance One" is still in the running order
And I still see "Draft 6"

### AC6: An empty half is shown as empty
Given the second half has one item
When I remove it
Then the second half shows "No items"
And the interval and the half's total of 0 minutes are still shown

### AC7: The API rejects removing an unknown item
Given version 6 doesn't contain item "itm_missing"
When a client sends a removal of "itm_missing" with base version 6
Then the response is 400 and nothing is saved

## Notes

- FRs: FR6, FR10
- Depends on: running-order.E3.S1. This reuses its item form, and adds "add item" and "remove item" change types.
- New items get a server-generated stable id.
- Out of scope: restoring a removed item, other than by adding it again or from a stored version.
