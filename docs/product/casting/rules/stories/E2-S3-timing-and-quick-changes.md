---
id: casting-rules.E2.S3
title: Flag short gaps as timing warnings and quick changes
epic: E2
status: done
---

## Story

As a member of the production team, I want to see when someone has little time between going off and coming back on, so that I can avoid rushed entrances and plan quick changes.

## Acceptance criteria

The examples use this saved running order. First half: "Opening Number" (5 minutes), "Pirate Sketch" (4), "Dance One" (3), "Song Two" (2), "Sketch Two" (6). Then a 20-minute interval. Second half: "Campfire Song" (5), "Finale" (8).

### AC1: A gap under 5 minutes is a warning
Given "Sam Example" is in "Opening Number" and "Dance One", and in nothing between
When I open either item's page
Then Sam's name shows a Warning icon
And the description reads "Warning: short gap. Only 4 minutes between 'Opening Number' and 'Dance One' (needs at least 5 minutes)"

### AC2: The gap adds up every item between
Given Sam is in "Pirate Sketch" and "Sketch Two", and in nothing between
When I open either item's page
Then the gap is 5 minutes ("Dance One" 3 plus "Song Two" 2)
And Sam's name shows a quick-change Info icon, not a warning

### AC3: A gap from 5 to under 8 minutes is a quick-change info
Given Sam is in "Opening Number" and "Song Two", and in nothing between
When I open either item's page
Then Sam's name shows an Info icon
And the description reads "Info: quick change. 7 minutes between 'Opening Number' and 'Song Two'"

### AC4: A gap of exactly 8 minutes needs nothing
Given the running order is saved with an 8-minute interval
And Sam is in "Sketch Two" and "Campfire Song"
When I open either item's page
Then Sam's name has no icon

### AC5: The interval counts towards the gap
Given the running order is saved with a 4-minute interval
And Sam is in "Sketch Two" and "Campfire Song"
When I open either item's page
Then Sam's name shows a Warning icon
And the description reads "Warning: short gap. Only 4 minutes between 'Sketch Two' and 'Campfire Song' (needs at least 5 minutes)"

### AC6: Only the next appearance is compared
Given Sam is in "Opening Number", "Pirate Sketch" and "Dance One"
When I open the "Opening Number" page
Then Sam's description lists only the back-to-back clash with "Pirate Sketch"
And says nothing about "Dance One"

### AC7: Back-to-back isn't also reported as a timing warning
Given Sam is a lead in "Opening Number" and a support in "Pirate Sketch"
When I open either item's page
Then Sam's description lists the back-to-back error only

### AC8: Info looks different from errors and warnings
Given names showing an Error, a Warning and an Info icon
When I look at them
Then each icon has its own shape as well as colour
And says "Error", "Warning" or "Info" in words

### AC9: The worst severity wins
Given Sam has a timing warning with one item and a quick-change info with another
When I open the item they share
Then Sam's name shows a single Warning icon
And its description lists both

## Notes

- Wording changed on 2026-10-16 at the user's request (ux-reviewer, during casting-rules.E2.S3): every description is "Severity: kind. detail" and names both items, so it reads the same on either item's page.
- On phones and other screens without hover, quick-change lines are normal weight, so errors and warnings stand out (user's choice, same review).
- FRs: FR4, FR5, FR6, FR11 (info)
- Depends on: casting-rules.E2.S2.
- AC4 and AC5 change only the interval's length in the running order above.
- Items with no length aren't expected (PRD assumption; see its Open questions).
- Out of scope: the Items list and Overview (E3).
