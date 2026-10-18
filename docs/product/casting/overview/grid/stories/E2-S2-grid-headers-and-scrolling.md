---
id: casting-overview-grid.E2.S2
title: Keep names and items readable in a wide grid
epic: E2
status: done
---

## Story

As a member of the production team, I want the grid to keep names in view and label each item while I scroll across a long show, so that I always know whose row and which item I'm looking at, even on a phone.

## Acceptance criteria

The examples use a running order where "Finale" is the 4th printed item of the second half.

### AC1: Column headers name the item, its programme number and its half
Given "Finale" is programme number 4 in the second half
When I look at the grid
Then its column header reads "4 · Finale (Second half)"
And programme numbers restart in the second half, as they do everywhere else in the app

### AC2: Names stay visible when scrolling across
Given a grid with 30 item columns
When I scroll the grid sideways to the last item
Then each row's first name and last name are still in view
And the section scrolls away with the items, so the names don't fill a phone screen

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
Then it reads "Entr'acte (First half, not in printed programme)", with no number

## Notes

- The two name columns are pinned; on phones a clash shows as its icon only in the grid (the by-person view has the words). Headings stay in view as a tall grid scrolls inside its own box.
- AC2-AC4 are CSS-only, so no unit test covers them and no browser walk was added: the PR says they were not automatically verified.
- FRs: FR10
- Depends on: casting-overview-grid.E2.S1
- ADR 0011: CLAUDE.md says to ask the user before adding a browser layout test. Offer to add a Playwright walk of the grid at 320px and 360px, don't add it unasked.
- Out of scope: the legend (E2.S3).
