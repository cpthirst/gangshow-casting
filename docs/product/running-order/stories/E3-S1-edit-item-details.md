---
id: running-order.E3.S1
title: Edit an item's details
epic: E3
status: ready
---

## Story

As a member of the production team, I want to correct an item's details in place, so that the running order stays the single, current source of truth.

## Acceptance criteria

### AC1: Editing an item saves a new version
Given "Pirate Panic" has 18 minutes at version 6
When I edit "Pirate Panic", change its minutes to 20 and save
Then its row shows "20"
And I see "Draft 7"

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
When I clear the title, or enter minutes of "-3" or "ten", and save
Then I see what needs fixing next to the field
And no new version is saved

### AC5: Cancelling leaves the item unchanged
Given I'm editing "Pirate Panic" and have changed its title
When I cancel
Then the row shows the original title
And I still see "Draft 6"

### AC6: Unprinting an item renumbers the half
Given "Pirate Panic" is numbered 2 and "Dance One" is numbered 3
When I edit "Pirate Panic", mark it as not printed and save
Then "Pirate Panic" is marked "Not in printed programme" and has no number
And "Dance One" is numbered 2

### AC7: Someone else's newer version isn't overwritten
Given someone else has saved a newer version since I opened the page
When I save an edit
Then my edit isn't applied
And I see the latest version with the "Someone else changed the running order" message

### AC8: The API validates edits
Given version 6 is the latest
When a client sends an edit with an empty title, negative minutes or an unknown item id
Then the response is 400 and nothing is saved

## Notes

- FRs: FR6, FR7, FR9
- Depends on: running-order.E2.S1. This adds an "edit item" change type to the same versions endpoint.
- Text limits are set in the shared schema. For example, title up to 120 characters and other text up to 500.
- Out of scope: adding and removing items (E3.S2), and editing the start time or interval.
