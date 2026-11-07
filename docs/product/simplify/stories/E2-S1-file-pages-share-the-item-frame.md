---
id: simplify.E2.S1
title: Build one item page frame, with the Scenery, SFX and Wardrobe pages on it
epic: E2
status: draft
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
Then one goes back to the Overview
And Previous and Next go to the SFX pages for items 1 and 3
And there's no Previous on the first item, and no Next on the last

### AC3: Notes are headed by department
Given someone on the Wardrobe page for "Opening Number"
When they reach the notes
Then they're headed "Wardrobe notes", as today

### AC4: An unknown item says not found
Given an address for the Scenery page of an item that isn't in the latest saved running order
When someone opens it
Then the page says "Item not found", that it isn't in the latest saved running order, and to choose an item from All items

### AC5: No running order, or a failure, shows one message
Given the running order fails to load
When someone opens the SFX page for any item
Then the frame shows one error message instead of the page

### AC6: The file pages work as today
Given "pat" has Stage
When pat adds, opens and deletes a file on the Scenery page and saves its notes
Then each works as it does today, and the visit is recorded on the Usage page as today

### AC7: Stepping between items while one loads
Given the Scenery page for item 1 is still loading
When someone chooses Next
Then the page shows item 2's files and notes, never item 1's

## Notes

- FRs: FR6, FR8, FR17 (these pages already load the shared way after E4.S1)
- Depends on: simplify.E4.S1
- The frame keeps each page's own list link: the department pages go back to the Overview, and Casting (E2.S4) back to Casting Items.
- Move the frame's behaviour into the frame's own tests. Delete a page test only once the frame's test covers the same behaviour (PRD risks).
- The existing browser layout walk "a department's page for a long-titled item" must still pass.
- Out of scope: the Mic plot, Props and Casting pages (E2.S2–E2.S4); the "View only" badge (E3.S2).
