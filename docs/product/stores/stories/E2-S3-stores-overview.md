---
id: stores.E2.S3
title: See every store on one overview
epic: E2
status: ready
---

## Story

As anyone planning a show, I want one page listing the Scenery, Props and Wardrobe stores and how many images each holds, so that I can see at a glance what's been recorded and open the store I need.

## Acceptance criteria

In each AC, the Scenery store has 12 images, the Props store has 1, and the Wardrobe store is empty.

### AC1: The Stores section opens with an Overview
Given anyone signed in opens the sidebar
Then the Stores section has **Overview** first, above Scenery, Props and Wardrobe

### AC2: The overview lists every store with its count
When they open the Stores overview
Then it lists Scenery with "12 images", Props with "1 image" and Wardrobe with "No images", in the order of the shared list of stores

### AC3: Each store links to its page
Given the Stores overview
When they choose Props
Then the Props stores page opens

### AC4: The overview is the same in every production
Given the overview shows the counts from AC2
When they switch to another production
Then the overview stays open and shows the same counts

### AC5: A store added to the shared list joins the overview
Given the shared list of stores has a fourth store
Then the overview lists it, with no change to the overview page

### AC6: Opening the overview records a visit
When they open the Stores overview
Then the Usage page records a visit to "Stores overview"

### AC7: A failure to load says so
Given the stores can't be loaded
When they open the Stores overview
Then the page says it couldn't load the stores, as the store page does

## Notes

- FRs: FR27, FR28
- Depends on: stores.E1.S1
- The overview reads the shared list of stores (FR3), so its rows, names and links come from one place (AC5 checks that once).
- The counts come from one request, not one per store.
- What Stores is for, and that it outlasts every production, goes in the Help entry (E5.S1), not on the page (CLAUDE.md, "Let the layout explain itself"). Decided by Nick Hirst, 2026-11-28.
- When E3.S3 adds Destroy, the counts cover only images still in store.
- A new page, so offer the user a browser layout walk for it; don't add one unasked.
- Out of scope: thumbnails or a preview of each store on the overview; search across stores.
