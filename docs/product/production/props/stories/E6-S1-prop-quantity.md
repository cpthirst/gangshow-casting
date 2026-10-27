---
id: production-props.E6.S1
title: Give a prop a quantity
epic: E6
status: ready
---

## Story

As someone on the props team, I want to say how many of a prop an item needs, so that "Umbrella ×10" is one prop on the list, and the counts show how much there is to find.

## Acceptance criteria

### AC1: A new prop starts at a quantity of 1
Given pat, with Stage, is adding a prop to Pirate Sketch
When pat opens Add prop
Then the form has a labelled Quantity field showing 1
And saving "Telescope" without changing it gives a card showing "Telescope", with no quantity shown

### AC2: A prop can have a quantity above 1
Given pat is adding a prop to Village Square
When pat adds "Umbrella" with a quantity of 10
Then the card shows "Umbrella ×10", and it's still there on reload

### AC3: Editing changes the quantity
Given Village Square has "Umbrella ×10"
When pat edits it, changes the quantity to 6 and saves
Then the card shows "Umbrella ×6"

### AC4: A quantity must be a whole number from 1 to 99
Given pat is adding or editing a prop
When pat enters 0, 100, 2.5 or leaves the quantity empty, and saves
Then it isn't saved, and the Quantity field says it must be a whole number from 1 to 99

### AC5: The API refuses a quantity out of range
Given "pat" has Stage
When pat sends a request to add or edit a prop with a quantity of 0, 100 or 2.5
Then the response is 400, and nothing is saved

### AC6: Props saved before quantities have a quantity of 1
Given "Treasure chest" was saved before props had a quantity
When pat opens Pirate Sketch's props page, or edits Treasure chest
Then the card shows "Treasure chest" with no quantity, and the edit form shows a quantity of 1

### AC7: An item's count adds up quantities
Given Village Square has "Umbrella ×10" and "Telescope"
When anyone opens the Production Overview
Then Village Square's props count is 11, read out as "11 props"

### AC8: Removing a prop takes its whole quantity off the count
Given Village Square has "Umbrella ×10" and "Telescope"
When pat removes Umbrella
Then the Overview's count for Village Square is 1

## Notes

- FRs: FR24, FR25
- Depends on: production-props.E4.S4
- The quantity is a number field with `inputmode="numeric"`, sitting next to the name, and fits at 320px.
- The "×" before the quantity goes into the card's text so screen readers read it, such as "Umbrella times 10". If that reads badly, a visually hidden "quantity 10" will do.
- A prop's name may already hold a number ("3 umbrellas"). Leave those as they are: nobody changes existing names.
- Sorting stays by name (FR21). The quantity doesn't change the order.
- The Word props list doesn't show quantities yet (E6.S4).
- Out of scope: choosing who carries the prop (E6.S2).
