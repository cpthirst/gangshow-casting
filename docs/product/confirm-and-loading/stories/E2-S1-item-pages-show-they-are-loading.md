---
id: confirm-and-loading.E2.S1
title: Item pages show they're loading
epic: E2
status: done
---

## Story

As a department volunteer on a slow signal, I want an item page to show it's loading, so that I can tell it isn't broken and wait rather than tapping again.

## Acceptance criteria

### AC1: Loading shows while the item's data is on its way
Given someone opens "Props: Pirate Sketch" and its data hasn't arrived yet
Then the page shows "Loading…" under its back, Previous and Next links

### AC2: It goes when the item shows
Given the page from AC1 is loading
When the data arrives
Then "Loading…" goes and the item's title, position and props show

### AC3: It goes when the item can't be found or loaded
Given an item page is loading
When the item turns out not to be in the saved running order, or the data fails to load
Then "Loading…" goes, and "Item not found", or "Couldn't load the item.", shows instead

### AC4: Stepping to another item loads again
Given "Props: Pirate Sketch" has loaded
When they choose Next and the next item's data hasn't arrived yet
Then the page shows "Loading…" again, not Pirate Sketch's props

### AC5: Screen readers hear it once
Given an item page starts loading
Then "Loading…" is announced politely, once

## Notes

- FRs: FR6
- Depends on: none
- The shared item page frame meets AC1–AC5 for all six item pages (Casting, Props, Scenery, SFX, Wardrobe, Mic plot). Test them once, in the frame's tests. No page needs its own test beyond its existing check that it uses the frame.
- No animation, so there's nothing to respect reduced motion for.
- Out of scope: the list pages' loading (PRD non-goal).
