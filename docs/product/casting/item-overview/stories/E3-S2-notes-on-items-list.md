---
id: casting-item-overview.E3.S2
title: Show an item's notes on the Items list
epic: E3
status: in-progress
---

## Story

As a member of the production team, I want to see each item's notes on the Items list, so that I can read them without opening every item.

## Acceptance criteria

### AC1: Notes show under the item on larger screens
Given Pirate Sketch's notes say "Hook needs a hat change before the finale"
When I open the Items list on a larger screen
Then the notes appear in full under Pirate Sketch's row, across the table

### AC2: Notes show at the bottom of the card on phones
Given Pirate Sketch has notes
When I open the Items list on a phone
Then the notes appear in full at the bottom of Pirate Sketch's card
And the page doesn't scroll sideways

### AC3: Items without notes show nothing extra
Given Campfire Song has no notes
When I open the Items list
Then nothing extra appears for Campfire Song

### AC4: Long notes wrap
Given an item's notes are 500 characters long
When I open the Items list
Then they wrap within the table or card

### AC5: Notes that can't be loaded don't hide the list
Given the notes can't be loaded
When I open the Items list
Then the items still show, with a message that the notes couldn't be loaded

## Notes

- FRs: FR9
- Depends on: casting-item-overview.E3.S1.
- Added on 2026-10-16 at the user's request.
