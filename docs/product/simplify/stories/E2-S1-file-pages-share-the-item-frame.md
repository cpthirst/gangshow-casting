---
id: simplify.E2.S1
title: Build one item page frame, with the Scenery, SFX and Wardrobe pages on it
epic: E2
status: done
---

## Story

As someone on the production team, I want every page about one item to have the same frame, so that I know where everything is whichever department's page I'm on.

## Acceptance criteria

### AC1: The frame's title names the department and the item
Given "Opening Number" is item 1 in the running order
When someone opens its Scenery page
Then the heading reads "Scenery: Opening Number", with the Help button beside it
And the item's position in the running order shows under it, as today

### AC2: Back, Previous and Next
Given someone is on the SFX page for item 2 of 3
When they use the frame's links
Then "All items" goes back to the Production overview
And Previous and Next go to the SFX pages for items 1 and 3
And there's no Previous on the first item, and no Next on the last

### AC3: Notes are headed by department
Given someone on the Wardrobe page for "Opening Number"
When they reach the notes
Then they're headed "Wardrobe notes", as today

### AC4: An unknown item says not found
Given an address for the Scenery page of an item that isn't in the latest saved running order
When someone opens it
Then the heading reads "Item not found", under it "It isn't in the latest saved running order. Choose an item from All items."
And "All items" still goes back to the Production overview

### AC5: A failed load shows one error message
Given the running order, or the item's SFX files, fail to load
When someone opens the SFX page for "Opening Number"
Then the page shows the one alert "Couldn't load the item." in place of the title, files and notes
And "All items" still goes back to the Production overview

### AC6: The file pages work as today
Given "pat" has Stage
When pat adds "set-plan.pdf" to the Scenery page for "Opening Number", opens it, deletes it, and saves the notes "Flats stage left"
Then each works as it does today
And one visit to that item's Scenery page is recorded for the Usage page, as today

### AC7: Stepping between items while one loads
Given someone stepped with Next from item 1's Scenery page to item 2's, which is still loading
When they choose Next again
Then the page shows item 3's title, files and notes, never item 2's, whichever load finishes last

## Notes

- FRs: FR6, FR8, FR17 (these pages already load the shared way after E4.S1)
- Depends on: simplify.E4.S1
- The frame keeps each page's own list link: the department pages go back to the Overview, and Casting (E2.S4) back to Casting Items.
- Move the frame's behaviour into the frame's own tests. Delete a page test only once the frame's test covers the same behaviour (PRD risks).
- The existing browser layout walk "a department's page for a long-titled item" must still pass.
- Out of scope: the Mic plot, Props and Casting pages (E2.S2–E2.S4); the "View only" badge (E3.S2).
