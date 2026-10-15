---
id: casting-item-overview.E2.S1
title: Show an item's roles as ordered cards
epic: E2
status: ready
---

## Story

As an item leader, I want an item's roles shown as cards in a fixed order, biggest parts first, so that I can read the item's casting at a glance and spot gaps.

## Acceptance criteria

### AC1: Each role is a card with a size pill
Given "Pirate Sketch" has a lead role "Captain Hook"
When I open its page
Then I see a card for "Captain Hook" with a pill reading "Lead"

### AC2: Roles are ordered by size
Given "Pirate Sketch" has an ensemble "Pirates", a cameo "Parrot", a lead "Captain Hook" and a support "Smee"
When I open its page
Then the cards read "Captain Hook", "Smee", "Parrot", "Pirates"

### AC3: Roles of the same size are in alphabetical order, ignoring case
Given "Pirate Sketch" has support roles "smee", "Bosun" and "Cook"
When I open its page
Then those cards read "Bosun", "Cook", "smee"

### AC4: An uncast role is marked
Given "Parrot" has nobody cast in it
When I open the "Pirate Sketch" page
Then the "Parrot" card shows "Uncast"

### AC5: Sizes are told apart without colour
Given "Pirate Sketch" has roles of all four sizes
When I view the page without colour, or with a screen reader
Then each card's size can be read as "Lead", "Support", "Cameo" or "Ensemble"

### AC6: The number of roles is announced
Given "Pirate Sketch" has 4 roles
When a screen reader reaches the roles
Then they are announced as a list of 4 items

## Notes

- FRs: FR3, FR4
- Depends on: casting-roles.E1.S1, which shows roles as a plain list. This story replaces that list with cards.
- Cast members' names on the cards come with casting-roles.E1.S3 (one person) and E2.S2 (ensemble members).
- Pill colours must meet contrast with their text label (NFR).
