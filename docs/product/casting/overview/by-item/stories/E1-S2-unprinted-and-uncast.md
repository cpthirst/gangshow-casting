---
id: casting-overview-by-item.E1.S2
title: Mark unprinted items, uncast roles and items with no roles
epic: E1
status: ready
---

## Story

As a member of the production team, I want the By item view to show which items aren't in the printed programme and which parts nobody plays yet, so that I can spot the gaps at a glance.

## Acceptance criteria

### AC1: An item left out of the printed programme is marked
Given "Scene Change Music" is in the running order but not in the printed programme
When I choose "By item"
Then "Scene Change Music" appears in its place in show order, in the grid's red italics, with no programme number

### AC2: An unprinted item doesn't shift the numbers
Given "Scene Change Music" sits between printed items 3 and 4
When I choose "By item"
Then the item after it is still numbered 4

### AC3: An empty role says Uncast
Given "Finale" has a support role "Narrator" with nobody in it
When I choose "By item"
Then the "Narrator" row's Cast reads "Uncast"

### AC4: An item with no roles says so
Given "Finale" has no roles
When I choose "By item"
Then under "Finale" it says no roles have been added yet, and there is no empty table

### AC5: Unprinted is told in words, not only colour
Given "Scene Change Music" is not in the printed programme
When a screen reader reads its heading
Then it hears that the item is not in the printed programme

## Notes

- FRs: FR3, FR5
- Depends on: E1.S1
- The red italics match the grid's unprinted headings (`unprintedHeadingColour`), so the two views agree.
- Out of scope: exports (E2).
