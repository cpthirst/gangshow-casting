---
id: simplify.E2.S2
title: Move the Mic plot item page onto the shared frame
epic: E2
status: draft
---

## Story

As someone on the Tech team, I want the Mic plot page for an item to have the same frame as the other item pages, so that moving between an item's departments needs no relearning.

## Acceptance criteria

### AC1: The frame shows the mic plot
Given "Opening Number" has a mic plot
When someone opens its Mic plot page
Then the heading reads "Mic plot: Opening Number", with the position, Back, Previous and Next, and "Mic plot notes", from the shared frame

### AC2: The channels work as today
Given "pat" has Tech
When pat assigns a cast member to channel 3 and saves
Then the channel shows that cast member as it does today

### AC3: Not found and errors come from the frame
Given an address for the Mic plot page of an item that isn't in the latest saved running order
When someone opens it
Then it shows the frame's "Item not found" message

### AC4: The mic plot loads the shared way
Given the API fails when the page asks for the item's mic plot
When someone opens the Mic plot page
Then the page shows its usual error message

## Notes

- FRs: FR6, FR8, FR17
- Depends on: simplify.E2.S1
- The existing browser layout walk "an item's 24 mics" must still pass.
- Out of scope: the Mic plot export from the Overview, which doesn't change.
