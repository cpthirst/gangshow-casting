---
id: simplify.E2.S2
title: Move the Mic plot item page onto the shared frame
epic: E2
status: done
---

## Story

As someone on the Tech team, I want the Mic plot page for an item to have the same frame as the other item pages, so that moving between an item's departments needs no relearning.

## Acceptance criteria

### AC1: The frame shows the mic plot
Given "Opening Number" is item 1 of 3 in the running order
When someone opens its Mic plot page
Then the heading reads "Mic plot: Opening Number", with the Help button beside it and "Item 1 · First half" under it
And "All items" goes back to the Production overview, there's no Previous, and Next goes to item 2's Mic plot page
And the notes under the channels are headed "Mic plot notes"

### AC2: The channels work as today
Given "lee" has Tech
When lee gives Mic 3 to Alex Morgan, who is in "Opening Number"
Then Mic 3 shows Alex Morgan, "Mic 3 given to Alex Morgan." is announced, and everyone opening the page later sees Alex Morgan on Mic 3

### AC3: Not found comes from the frame
Given an address for the Mic plot page of an item that isn't in the latest saved running order
When someone opens it
Then the heading reads "Item not found", with no channels
And "All items" still goes back to the Production overview

### AC4: A failed load shows the frame's error
Given the API fails when the page asks for the mic plot
When someone opens the Mic plot page for "Opening Number"
Then the page shows the one alert "Couldn't load the item." in place of the title, channels and notes

### AC5: No mic plot yet means every channel is free
Given the API has no mic plot for the production yet (it answers not found)
When someone opens the Mic plot page for "Opening Number"
Then it shows Mic 1 to Mic 24, each with no one on it, not an error

## Notes

- FRs: FR6, FR8, FR17
- Depends on: simplify.E2.S1
- The existing browser layout walk "an item's 24 mics" must still pass.
- Out of scope: the Mic plot export from the Overview, which doesn't change.
