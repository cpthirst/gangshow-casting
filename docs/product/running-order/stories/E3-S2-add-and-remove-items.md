---
id: running-order.E3.S2
title: Add and remove items
epic: E3
status: done
---

## Story

As an admin on the production team, I want to add a new item or drop one from the show, so that the running order keeps up as items are confirmed or cut.

## Acceptance criteria

### AC1: Adding an item to a half
Given the second half ends with "Big Finish" at version 6
When I choose "Add item" for the second half, enter the title "Encore" and add it
Then "Encore" appears at the end of the second half
And I see "Unsaved changes", ready to save as Draft 7

### AC2: A new item needs a title
Given I'm adding an item
When I try to add it without a title
Then I see that a title is required
And nothing is added

### AC3: Cancelling an add adds nothing
Given I'm adding an item and have typed a title
When I cancel
Then nothing is added
And there are no unsaved changes

### AC4: Removing an item asks first
Given "Dance One" is in the first half
When I choose "Remove" on "Dance One"
Then I'm asked to confirm removing "Dance One"
And the question says its casting notes and roles go when the draft is saved

### AC5: Confirming removal is an unsaved change
Given I've been asked to confirm removing "Dance One" at Draft 6
When I confirm
Then "Dance One" is no longer in the running order
And I see "Unsaved changes"

### AC6: Cancelling removal keeps the item
Given I've been asked to confirm removing "Dance One"
When I cancel
Then "Dance One" is still in the running order
And there are no unsaved changes

### AC7: An empty half is shown as empty
Given the second half has one item
When I remove it
Then the second half shows "No items"
And the interval and the half's total of 0 minutes are still shown

### AC8: Reset brings a removed item back
Given I've removed "Dance One" without saving
When I press "Reset"
Then "Dance One" is back in the running order
And its casting notes and roles are untouched

### AC9: Only admins can add or remove
Given I'm signed in as a team member who isn't an admin
When I look at the running order
Then "Add item" and "Remove" are disabled
And they say "Only admins can add items" and "Only admins can remove items"

### AC10: The API accepts a saved draft with items added and removed
Given version 6 holds items A, B and C
When an admin saves a draft with base version 6 that removes B and adds a new item D
Then the response is 201 with version 7 holding A, C and D, and D has a stable id

### AC11: The API refuses a draft that invents or duplicates an item
Given version 6 holds items A, B and C
When an admin saves a draft that holds an item with an id the show has never had, or A twice, or a new item with no title
Then the response is 400 and nothing is saved

### AC12: Saving a removal deletes the item's casting notes and roles
Given "Dance One" has casting notes and two roles, one with cast members in it, and "Pirate Panic" has a role
When an admin saves a draft that removes "Dance One"
Then the notes and both roles of "Dance One" are gone, with who was cast in them
And the notes and role of "Pirate Panic" are untouched

### AC13: The API refuses non-admins
Given I'm signed in as a team member who isn't an admin
When I save a draft that adds or removes an item
Then the response is 403 and nothing is saved

## Notes

- Revived 2026-10-18 (was dropped 2026-10-10). Refined with the user: admin only, and the removal cascade runs on save.
- FRs: FR6, FR10
- Depends on: running-order.E3.S1. This reuses its item form. Adds and removals are unsaved changes, saved or reset with everything else.
- **Admin only**: the save route is already admin-only (ADR 0018), so AC13 holds by the route list. The page disables "Add item" and "Remove" for non-admins with a tooltip, as Delete does on the Cast page.
- **New items** are sent without an id and the server gives each a stable id. The page holds a temporary id for an unsaved item.
- **Removal cascade** (agreed 2026-10-16, casting-item-overview FR8, ADR 0010): nothing about a removed item is kept. Reset undoes a removal because nothing is deleted until the draft is saved. After the new version is saved, the server deletes the notes and roles (and the cast in them) of any item not in it. It does this on every save, so a failed clean-up is repaired by the next save.
- The confirmation names the item and counts its roles, as the Cast page's delete confirmation does.
- Older saved versions still hold a removed item's running-order details; they are not casting data.
- Out of scope: restoring a removed item, other than by adding it again or from a stored version.
