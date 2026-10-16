---
id: casting-roles.E4.S1
title: Add all the remaining cast to an ensemble
epic: E4
status: in-progress
---

## Story

As a member of the production team, I want to put everyone not yet in this item into an ensemble with one button, so that I can fill a big ensemble quickly and tidy it up afterwards.

## Acceptance criteria

The examples use "Pirate Sketch", whose roles are "Captain Hook" (lead, "Sam Example") and the ensemble "Pirates" ("Alex Sample"). The cast list is Sam Example, Alex Sample, Jo Newcomer and Zoë Adams.

### AC1: The button is there when editing an ensemble
Given I'm editing "Pirates"
When I look at the form's buttons
Then I see "Add All Cast" beside Save and Cancel

### AC2: Not for other role sizes
Given I'm editing "Captain Hook" (lead)
When I look at the form's buttons
Then there is no "Add All Cast" button

### AC3: It appears when adding a role as an ensemble
Given I'm adding a role
When I choose "Ensemble" as its size
Then I see "Add All Cast" beside Save and Cancel
And it goes away if I choose another size

### AC4: It adds everyone not in a role in this item
Given I'm editing "Pirates"
When I press "Add All Cast"
Then the members listed are Alex Sample, Jo Newcomer and Zoë Adams
And Sam Example isn't added, because they're already Captain Hook

### AC5: Parts in other items don't matter
Given Jo Newcomer is a lead in "Opening Number"
When I press "Add All Cast" while editing "Pirates"
Then Jo is added

### AC6: Nothing is saved until Save
Given I pressed "Add All Cast" while editing "Pirates"
When I press Cancel
Then "Pirates" still has only Alex Sample

### AC7: People can be removed before saving
Given I pressed "Add All Cast" while editing "Pirates"
When I remove Zoë Adams and press Save
Then "Pirates" holds Alex Sample and Jo Newcomer

### AC8: A new ensemble can be filled the same way
Given I'm adding a role "Crowd" as an Ensemble
When I press "Add All Cast" and Save
Then "Crowd" holds everyone not already in a role in "Pirate Sketch": Jo Newcomer and Zoë Adams

### AC9: Nobody left to add
Given everyone on the cast list is already in a role in this item
When I look at the form's buttons
Then "Add All Cast" can't be pressed

### AC10: No casting rules are checked
Given "Add All Cast" puts Jo Newcomer in "Pirate Sketch", straight after their lead in "Opening Number"
When I press Save
Then the role saves
And Jo's name shows a clash icon as usual

## Notes

- FRs: FR11 (and the FR5 exception it makes for the add form)
- Depends on: casting-roles.E2.S2 (ensemble members), done.
- Added on 2026-10-16 at the user's request.
- Out of scope: adding everyone from a section or unit only; filling several ensembles at once.
