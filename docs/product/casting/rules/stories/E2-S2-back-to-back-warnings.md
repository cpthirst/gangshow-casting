---
id: casting-rules.E2.S2
title: Flag back-to-back appearances with an ensemble as warnings
epic: E2
status: done
---

## Story

As a member of the production team, I want back-to-back appearances that involve an ensemble shown as warnings rather than errors, so that I can tell the flexible clashes from the ones that can't work.

## Acceptance criteria

The examples use the running order in casting-rules.E2.S1: first half "Opening Number", "Pirate Sketch", "Dance One"; then the interval; second half "Campfire Song", "Finale".

### AC1: A named part then an ensemble is a warning
Given "Sam Example" is a lead in "Opening Number" and in the ensemble of "Pirate Sketch"
When I open either item's page
Then Sam's name shows a Warning icon, not an Error icon

### AC2: An ensemble then a named part is a warning
Given Sam is in the ensemble of "Opening Number" and a cameo in "Pirate Sketch"
When I open either item's page
Then Sam's name shows a Warning icon

### AC3: Two ensembles in a row are a warning
Given Sam is in the ensembles of "Opening Number" and "Pirate Sketch"
When I open either item's page
Then Sam's name shows a Warning icon

### AC4: The description says it's a warning and why
Given Sam has the warning in AC1
When I hover over or focus the icon on the "Pirate Sketch" page
Then I see "Warning: back-to-back. Also Lead in 'Opening Number', straight before this item"

### AC5: Warnings look different from errors
Given one person's name shows a Warning icon and another's shows an Error icon
When I look at them
Then the two icons differ in shape as well as colour
And each says "Warning" or "Error" in words

### AC6: One icon at the worst severity, with every clash described
Given Sam is a lead in "Opening Number", a support in "Pirate Sketch", and in the ensemble of "Dance One"
When I open the "Pirate Sketch" page
Then Sam's name shows a single Error icon
And its description lists both the error with "Opening Number" and the warning with "Dance One"

## Notes

- FRs: FR3, FR7 (worst severity, every clash described), FR11 (warning)
- Depends on: casting-rules.E2.S1.
- Out of scope: timing and quick changes (E2.S3), the Items list and Overview (E3).
