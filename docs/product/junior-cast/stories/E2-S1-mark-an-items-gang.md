---
id: junior-cast.E2.S1
title: Mark which gang an item is for
epic: E2
status: done
---

## Story

As an admin keeping the running order, I want to mark each item as for the Senior gang, the Junior gang or both, so that casting knows who can be in it.

## Acceptance criteria

### AC1: A new item is for the Senior gang
Given the Running order page for the 2027 production
When an admin adds an item "Campfire Song" without changing its Gang, and saves
Then Campfire Song's Gang is Senior

### AC2: An item can be marked Junior
Given "Beaver Bop" is for the Senior gang
When an admin edits Beaver Bop, sets its Gang to Junior, and saves
Then Beaver Bop's Gang is Junior when the running order is next opened

### AC3: An item can be marked for both gangs
Given "Grand Finale" is for the Senior gang
When an admin edits Grand Finale, sets its Gang to Both, and saves
Then Grand Finale's Gang is Both when the running order is next opened

### AC4: Items saved before this release are Senior
Given a running order version saved before items had a gang
When anyone opens the running order
Then every item's Gang is Senior

### AC5: A gang outside the list is refused
Given the running order API
When a client saves a version with an item whose gang is "infants"
Then the request is refused as invalid
And no new version is saved

### AC6: Reset undoes a gang change before it's saved
Given an admin has set "Beaver Bop" to Junior on the Running order page but not saved
When they choose Reset
Then Beaver Bop's Gang is Senior again

## Notes

- FRs: FR2, FR3, FR9, FR10
- Depends on: none
- The control is labelled **Gang** (Senior, Junior, Both), because the item's details already have a free-text **Cast** field. It sits with the item's other details in the item editor.
- Only admins can save the running order. A member's or read-only account's save is already refused by the running order's own permission. Check that's wired up; don't test it again.
- The gang is part of the item, so cutting an item takes it with it (FR10). The running order's clean-up after a cut needs no new entry. Say so in a test of the item's shape, not a new clean-up test.
- The running order's lists (Running order, Casting items) don't show the gang (PRD non-goal).
- Until E2.S3, changing an item's gang leaves its roles' cast as they are.
- Out of scope: filtering the casting search (E2.S2); removing people who no longer match (E2.S3).
