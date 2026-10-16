---
id: casting-rules.E2.S1
title: Flag back-to-back named parts as errors on an item's page
epic: E2
status: in-progress
---

## Story

As a member of the production team in a casting meeting, I want an error shown by anyone cast in named parts in two items in a row, so that I can fix casting that can't work on the night.

## Acceptance criteria

The examples use this saved running order. First half: 1 "Opening Number", 2 "Pirate Sketch", 3 "Dance One". Then the interval. Second half: 4 "Campfire Song", 5 "Finale".

### AC1: Named parts in two items in a row are an error on both items
Given "Sam Example" is a lead in "Opening Number" and a support in "Pirate Sketch"
When I open the casting page of either item
Then Sam's name shows an Error icon

### AC2: The description says what the clash is and with which item
Given Sam has the back-to-back error in AC1
When I hover over or focus the icon on the "Pirate Sketch" page
Then I see "Error: back-to-back. Also Lead in 'Opening Number', straight before this item"

### AC3: The icon is read out in words
Given Sam's name shows the Error icon
When a screen reader or keyboard user reaches it
Then it can be focused, and it is read as the word "Error" followed by the full description

### AC4: On phones the description is written out
Given Sam's name shows the Error icon
When I open the item's page on a phone
Then the description is written out under Sam's name, with no hover or tap needed
And the page doesn't scroll sideways

### AC5: Their biggest part in an item counts, wherever their name appears
Given Sam is "Captain Hook" (lead) and in the "Pirates" ensemble in "Pirate Sketch"
And is a cameo in "Opening Number"
When I open the "Pirate Sketch" page
Then Sam's name shows an Error icon on the "Captain Hook" card and in the "Pirates" list

### AC6: Items that aren't next to each other aren't back-to-back
Given Sam is a lead in "Opening Number" and in "Dance One", with "Pirate Sketch" between them
When I open either item's page
Then Sam has no back-to-back error

### AC7: The interval separates the halves
Given Sam is a lead in "Dance One" and in "Campfire Song"
When I open either item's page
Then Sam has no back-to-back error

### AC8: People without a clash have no icon
Given "Alex Sample" is cast only in "Opening Number"
When I open the "Opening Number" page
Then Alex's name has no icon

### AC9: Recasting clears the error
Given Sam has the back-to-back error in AC1
When I remove Sam from the support role in "Pirate Sketch" and open "Opening Number"
Then Sam's name has no icon

### AC10: Saving a new running order clears the error
Given Sam has the back-to-back error in AC1
When I save a running order with "Dance One" moved between "Opening Number" and "Pirate Sketch", and open "Opening Number"
Then Sam has no back-to-back error

### AC11: A failed roles load shows no icons
Given the item loads but the roles can't be loaded
When I open the item's page
Then I see that the roles couldn't be loaded
And no clash icons are shown

## Notes

- FRs: FR1, FR2, FR7, FR10, FR11 (error), FR12, FR13
- Depends on: none.
- Walking skeleton: builds the clash calculation (a plain, unit-tested function over the saved running order and the roles) and the shared icon with its description, which E2.S2–E3.S2 reuse.
- AC10 would also give Sam a timing finding once E2.S3 lands; this story only checks there's no back-to-back error.
- AC11 keeps the page's existing failure message, "Couldn't load the item." (PRD FR13: existing "couldn't load" messages stay).
- Browser layout tests: at the user's go-ahead (2026-10-16), a walk checks a clash's description is written out on phones and fits (AC4).
- If this passes ~400 changed lines, split the phone write-out (AC4) into its own story.
- Out of scope: ensemble warnings (E2.S2), timing and quick changes (E2.S3), the Items list and Overview (E3).
