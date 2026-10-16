---
id: casting-rules.E3.S1
title: Show clash icons on the Items list
epic: E3
status: in-progress
---

## Story

As a member of the production team, I want the Items list to show which items have casting clashes, so that I can see where to look without opening every item.

## Acceptance criteria

### AC1: An item with a clash shows an icon at its worst severity
Given "Pirate Sketch" has one back-to-back error and two timing warnings
When I open the Items page
Then "Pirate Sketch" shows an Error icon

### AC2: The description says how many of each, and who
Given the clashes in AC1 involve "Sam Example" and "Alex Sample"
When I hover over or focus the icon
Then I see "1 error, 2 warnings: Sam Example, Alex Sample"

### AC3: An item with only quick changes shows Info
Given "Campfire Song"'s only clash is a quick-change info for "Jo Newcomer"
When I open the Items page
Then "Campfire Song" shows an Info icon

### AC4: Items without clashes have no icon
Given "Finale" has no clashes
When I open the Items page
Then "Finale" has no icon

### AC5: On phones the description is written out
Given "Pirate Sketch" shows an Error icon
When I open the Items page on a phone
Then the description is written out under the item, with no hover or tap needed
And the page doesn't scroll sideways

### AC6: A failed roles load shows no icons
Given the running order loads but the roles can't be loaded
When I open the Items page
Then I see that the roles couldn't be loaded
And no clash icons are shown

## Notes

- FRs: FR8, FR10, FR13
- Depends on: casting-rules.E2.S3.
- Uses the same icons and the same clash calculation as the item page.
- Showing info on this page follows the PRD's assumption (Open questions).
- Out of scope: the Overview (E3.S2).
