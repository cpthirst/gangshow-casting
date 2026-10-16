---
id: casting-overview-timeline.E1.S2
title: Say what each dot is
epic: E1
status: ready
---

## Story

As a member of the production team, I want to find out which item a dot stands for, and screen-reader users want the timeline read as a sentence, so that everyone can use the picture, not just see it.

## Acceptance criteria

The examples use the running order in casting-overview-timeline.E1.S1, where "Dance One" is item 3.

### AC1: Hovering a dot names the item and the part
Given "Sam Example" is a support in "Dance One"
When I hover over Sam's third dot
Then I see "3 · Dance One: Support"

### AC2: Hovering a dot they're not in names just the item
Given Sam is not in "Opening Number"
When I hover over Sam's first dot
Then I see "1 · Opening Number"

### AC3: Items not in the printed programme say so
Given "Entr'acte" is not in the printed programme
When I hover over its dot
Then I see "Entr'acte (not in printed programme)"

### AC4: Someone with several parts in an item shows their biggest
Given Sam is "Captain Hook" (lead) and in the "Pirates" ensemble in "Pirate Sketch"
When I hover over Sam's "Pirate Sketch" dot
Then I see "2 · Pirate Sketch: Lead"

### AC5: Screen readers hear one sentence
Given Sam is in "Pirate Sketch" and "Finale" out of 5 items
When a screen reader reads Sam's card
Then it hears "In 2 of 5 items: Pirate Sketch, Finale"
And not each dot one by one

### AC6: Someone in no items
Given "Jo Newcomer" is in no roles
When a screen reader reads Jo's card
Then it hears "In none of the 5 items"

### AC7: Dots aren't tab stops
Given the Overview with 60 cast members
When I move through the page with the keyboard
Then the dots are never focused

## Notes

- FRs: FR5, FR6
- Depends on: casting-overview-timeline.E1.S1.
- Hover text uses the app's existing tooltip look. Phones have no hover (PRD non-goal); the sentence covers screen readers.
- Out of scope: shrinking to fit phones (E1.S3).
