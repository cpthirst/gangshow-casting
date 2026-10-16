---
id: casting-items.E2.S1
title: Show each item's role counts
epic: E2
status: done
---

## Story

As a member of the production team in a casting meeting, I want to see how many roles each item has and how many are cast, so that I can tell at a glance which items still need casting.

## Acceptance criteria

### AC1: An item shows its total roles and roles cast
Given "Pirate Sketch" has 5 roles, 3 of which have a cast member
When I open the Items page
Then "Pirate Sketch" shows "Roles 5 · Cast 3"

### AC2: An item with no roles says so
Given "Campfire Song" has no roles
When I open the Items page
Then "Campfire Song" shows "No roles yet"

### AC3: An ensemble role counts as cast once it has anyone in it
Given "Opening Number" has a lead with "Sam Example" and an ensemble role with "Alex Sample"
And an uncast cameo role
When I open the Items page
Then "Opening Number" shows "Roles 3 · Cast 2"

### AC4: Counts include roles added since the page was last open
Given "Campfire Song" shows "No roles yet"
When I open "Campfire Song", add an uncast role, and go back to the Items page
Then "Campfire Song" shows "Roles 1 · Cast 0"

### AC5: Counts are read out in words
Given "Pirate Sketch" shows "Roles 5 · Cast 3"
When a screen reader reads the item
Then it hears "5 roles, 3 cast"

### AC6: A failed roles load is reported, not shown as zero
Given the running order loads but the roles can't be loaded
When I open the Items page
Then the items are still listed
And I see that the role counts couldn't be loaded, with no item shown as "No roles yet"

## Notes

- FRs: FR2
- Depends on: casting-items.E1.S1, casting-roles.E1.S3 (casting someone in a role).
- Counts are worked out from the production's roles (casting-roles), never stored.
- Out of scope: warning and error icons (casting rules PRD).
