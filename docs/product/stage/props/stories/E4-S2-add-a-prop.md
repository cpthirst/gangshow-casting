---
id: stage-props.E4.S2
title: Open an item's props and add a prop
epic: E4
status: ready
---

## Story

As someone on the props team, I want to open an item and add the props it needs, so that the show's props list lives in iCUE instead of on paper.

## Acceptance criteria

### AC1: The item's props page shows where the item is
Given "Pirate Sketch" is item 2 in the first half
When anyone opens its props page from the Props page
Then it shows "Pirate Sketch" and "Item 2 · First half", and the browser tab names the item
And it has a way back to the Props page

### AC2: An item with no props says so
Given "Pirate Sketch" has no props
When its props page is open
Then it says no props have been added yet

### AC3: The page has its own address
Given someone has Pirate Sketch's props page open
When they refresh, or open its address directly
Then the same item's props page opens

### AC4: An unknown item
Given an address for an item that isn't in the latest saved running order
When it's opened
Then the page says the item wasn't found, with a link back to the Props page

### AC5: Stage adds a prop by name
Given "pat" has the Stage permission, on Pirate Sketch's props page
When pat chooses Add prop, enters "Treasure chest" and saves
Then a card for "Treasure chest" appears
And it's still there when the page is reloaded, and the Props page counts 1 prop for Pirate Sketch

### AC6: An admin adds a prop
Given "alex" is an Admin
When alex adds the prop "Parrot" to Pirate Sketch
Then it is saved, as for Stage

### AC7: A prop needs a name
Given pat is adding a prop
When pat saves with the name empty, or only spaces
Then it isn't saved, and the name field says a prop needs a name

### AC8: Props are listed alphabetically, numbers by value
Given Pirate Sketch has the props "umbrella 10", "Treasure chest" and "Umbrella 2"
When its props page is open
Then they're listed "Treasure chest", "Umbrella 2", "umbrella 10"

### AC9: Without Stage there's no Add prop
Given "sam" has the Casting permission only
When sam opens Pirate Sketch's props page
Then there's no Add prop, and the page shows the line "You have read-only access"

### AC10: The API refuses a prop from anyone without Stage
Given "sam" has the Casting permission only
When sam sends a request to add a prop
Then the response is 403 saying "You have read-only access.", and nothing is added

### AC11: A failed save keeps what was typed
Given pat is adding "Treasure chest"
When saving fails
Then pat is told, and the name is still in the field

## Notes

- FRs: FR16, FR17, FR21
- Depends on: stage-props.E4.S1
- The first props change route, which names Stage as its permission (E1.S1). Tech and Casting alone don't allow it.
- A prop name has a sensible maximum length, decided in the shared schema, as role names have.
- The page follows the item's casting page: the same heading and position line, back link and empty state.
- Out of scope: roles on a prop (E4.S3), editing and removing (E4.S4), props notes (E4.S5), and Previous/Next between items, which the PRD doesn't ask for.
