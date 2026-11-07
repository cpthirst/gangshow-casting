---
id: simplify.E2.S4
title: Move the Casting item page onto the shared frame
epic: E2
status: draft
---

## Story

As someone on the casting team, I want the Casting page for an item to look like the other item pages, so that I can see at a glance that I'm on the casting for an item and not its props.

## Acceptance criteria

### AC1: The title names Casting
Given "Pirate Sketch" is in the running order
When someone opens its Casting page
Then the heading reads "Casting: Pirate Sketch"

### AC2: The notes are headed Casting notes
Given someone on the Casting page for "Pirate Sketch"
When they reach the notes
Then they're headed "Casting notes"

### AC3: Back goes to Casting Items
Given someone on the Casting page for item 2 of 3
When they use the frame's links
Then one goes back to Casting Items
And Previous and Next go to the Casting pages for items 1 and 3

### AC4: Roles and casting work as today
Given "pat" has Casting
When pat adds a role "Captain", casts "Alex Smith" in it, edits it and deletes it
Then each works as it does today, including back-to-back clashes

### AC5: A visit is recorded as today
Given "jo" opens the Casting page for "Pirate Sketch"
When an admin opens the Usage page
Then the visit counts as an item page, as it does today

### AC6: Not found and errors come from the frame
Given an address for the Casting page of an item that isn't in the latest saved running order
When someone opens it
Then it shows the frame's "Item not found" message

## Notes

- FRs: FR6, FR8, FR17
- Depends on: simplify.E2.S1
- The existing browser layout walks "an item's add-role and edit-role forms" and "Previous and Next share a row" must still pass.
- Check whether Help or Welcome quotes the old title or the "Notes" heading, and update them if so.
