---
id: stores.E3.S4
title: Search a store by name or description
epic: E3
status: ready
---

## Story

As anyone planning a show, I want to search a store's images by name or description, so that I can answer "have we got a crown?" without scrolling through hundreds of photos, including ones destroyed in case we need to rebuild them.

## Acceptance criteria

In each AC, the Wardrobe store has cloak.jpg ("Red velvet, adult size"), crown.jpg ("Gold, child's size"), tunic.jpg and gold-sash.jpg, which is destroyed. Anyone signed in is on its page.

### AC1: The store page has a search
Then above the grid there's a labelled search field, like the Cast page's filters, and a live count of "4 images"

### AC2: Searching matches names
When they type "crown"
Then the grid shows only crown.jpg, and the count reads "1 of 4 images"

### AC3: Searching matches descriptions
When they type "velvet"
Then the grid shows only cloak.jpg

### AC4: Case and position don't matter
When they type "GOLD"
Then the grid shows crown.jpg, then gold-sash.jpg greyed out at the bottom

### AC5: Destroyed images can be found and opened
Given the search from AC4
When they open gold-sash.jpg
Then the viewer opens it, with its info button

### AC6: The viewer swipes only through the matches
Given the search from AC4
When they open crown.jpg and go to the next image
Then the viewer shows gold-sash.jpg, and nothing outside the search

### AC7: No matches says so
When they type "wig"
Then the grid is replaced by "No images match this search."

### AC8: Clear shows everything again
Given the search from AC2
When they choose Clear
Then the field empties and all four images show

### AC9: Screen readers hear the count
When the search changes
Then screen readers hear the new count, as on the Cast page

### AC10: An empty store has no search
Given the Props store is empty
When anyone opens its page
Then there's no search, only the empty message

## Notes

- FRs: FR33
- Depends on: stores.E3.S3 (destroyed images in the results), stores.E3.S1 (descriptions)
- Filtering happens in the browser on the store's one request (FR6's performance note). No new API.
- Matching is plain text, not whole words: "gold" matches "Gold, child's size" and gold-sash.jpg. A destroy reason isn't searched.
- The filter bar and live count follow the Cast page's (`CastPage.vue`). If that markup would be copied a second time, extract the shared piece first (CLAUDE.md, "Extend the shared piece").
- Decided by Nick Hirst, 2026-11-28: the search is on each store page, not across stores.
- Out of scope: searching across all stores from the overview; keeping the search in the URL.
