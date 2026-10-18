---
id: casting-overview-grid.E2.S2
title: Keep names and items readable in a wide grid
epic: E2
status: ready
---

## Story

As a member of the production team, I want the grid to keep names in view and label each item while I scroll across a long show, so that I always know whose row and which item I'm looking at, even on a phone.

## Acceptance criteria

The examples use a running order where item 7 is "Finale".

### AC1: Column headers name the item and its position
Given item 7 is "Finale"
When I look at the grid
Then its column header reads "7 · Finale"

### AC2: Names stay visible when scrolling across
Given a grid with 30 item columns
When I scroll the grid sideways to the last item
Then each row's first name, last name and section are still in view

### AC3: Column headers stay with their columns
Given the grid is scrolled sideways
When I look at an item column
Then its header is directly above it

### AC4: Only the grid scrolls sideways
Given a grid with 30 item columns at 320px and 360px wide
When the Overview is showing the grid
Then the page itself does not scroll sideways
And the grid scrolls sideways within its own area

### AC5: Items not in the printed programme say so
Given "Entr'acte" is not in the printed programme
When I look at its column header
Then it says it is not in the printed programme

## Notes

- FRs: FR10
- Depends on: casting-overview-grid.E2.S1
- ADR 0011: CLAUDE.md says to ask the user before adding a browser layout test. Offer to add a Playwright walk of the grid at 320px and 360px, don't add it unasked.
- Out of scope: the legend (E2.S3).
