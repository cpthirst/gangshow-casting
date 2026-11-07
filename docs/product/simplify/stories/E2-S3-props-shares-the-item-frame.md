---
id: simplify.E2.S3
title: Move the Props item page onto the shared frame, and record its visits
epic: E2
status: done
---

## Story

As an admin, I want the Props page for an item to share the frame and have its visits recorded like the other departments', so that the Usage page shows who uses Props too.

## Acceptance criteria

### AC1: The frame shows the props
Given "Opening Number" has props
When someone opens its Props page
Then the heading reads "Props: Opening Number", with the position, Back, Previous and Next, and "Props notes", from the shared frame

### AC2: Props work as today
Given "pat" has Stage
When pat adds a prop "Cutlass" carried by "Alex Smith", edits it and deletes it
Then each works as it does today

### AC3: A visit is recorded
Given "jo" opens the Props page for "Opening Number"
When an admin opens the Usage page
Then jo's activity shows "opened Opening Number's Props page"
And "Props pages" is counted in jo's uses and the totals, like the Scenery, SFX, Mic plot and Wardrobe pages

### AC4: A failed recording never shows
Given recording the visit fails
When "jo" opens the Props page
Then the page shows its props and no error

### AC5: Not found and errors come from the frame
Given an address for the Props page of an item that isn't in the latest saved running order
When someone opens it
Then it shows the frame's "Item not found" message

## Notes

- FRs: FR6, FR7, FR8, FR17
- Depends on: simplify.E2.S1
- Recording Props visits adds one kind of usage event to the shared request schema; the change is additive.
- Props pages load their data the shared way (FR17): no props or casting saved yet shows none, rather than an error.
- The existing browser layout walk "an item's props" must still pass.
