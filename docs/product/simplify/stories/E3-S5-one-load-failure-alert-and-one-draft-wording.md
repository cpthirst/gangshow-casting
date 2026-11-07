---
id: simplify.E3.S5
title: Show one load-failure alert on the Overview, and word the draft number the same everywhere
epic: E3
status: ready
---

## Story

As someone on the production team, I want one clear alert when parts of the Overview fail to load, and the draft number worded the same on every page, so that problems don't stack up above the show and the same thing always reads the same way.

## Acceptance criteria

### AC1: Several failures make one alert
Given the props counts, the mic plot counts and the notes all fail to load
When someone opens the Production overview
Then one alert shows, naming all three
And the running order still shows beneath it

### AC2: One failure names just that one
Given only the scenery file counts fail to load
When someone opens the Production overview
Then one alert names only the scenery counts

### AC3: No failures, no alert
Given everything loads
When someone opens the Production overview
Then no alert shows

### AC4: Export failures stay separate
Given generating the props list fails
When someone chooses Generate Props List
Then its own "Couldn't generate the props list. Try again." alert shows, as today

### AC5: The draft number reads the same everywhere
Given the latest saved running order is Draft 3
When someone opens Running order, Casting Items and the Production overview
Then each shows "Draft 3", and none says "Based on Draft 3"

## Notes

- FRs: FR14, FR15
- Depends on: none
