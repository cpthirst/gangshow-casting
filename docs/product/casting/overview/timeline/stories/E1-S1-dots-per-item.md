---
id: casting-overview-timeline.E1.S1
title: Show a row of dots for each person's items
epic: E1
status: done
---

## Story

As a member of the production team in a casting meeting, I want each person's Overview card to show a dot for every item, marked where they appear, so that I can see their whole evening at a glance.

## Acceptance criteria

The examples use this saved running order. First half: "Opening Number", "Pirate Sketch", "Dance One". Then the interval. Second half: "Campfire Song", "Finale".

### AC1: One dot per item, in show order
Given the running order above
When I open the Overview
Then each person's card shows 5 dots in a row, in the order of the show

### AC2: The interval is a wider gap
Given the running order above
When I look at a person's dots
Then there is a visibly wider gap between the third and fourth dots, where the interval falls

### AC3: A green circle-dot where they appear
Given "Sam Example" is cast in "Pirate Sketch" and "Finale"
When I open the Overview
Then Sam's second and fifth dots are green circle-dots

### AC4: A grey circle where they don't
Given Sam is cast in "Pirate Sketch" and "Finale" only
When I open the Overview
Then Sam's other three dots are grey plain circles, a different shape from the circle-dot

### AC5: Any part counts, however small
Given "Alex Sample" is one of ten in the "Opening Number" ensemble
When I open the Overview
Then Alex's first dot is a green circle-dot

### AC6: Items not in the printed programme count
Given "Entr'acte" is in the second half but not in the printed programme
And Sam is cast in it
When I open the Overview
Then Sam has a dot for "Entr'acte" in its place, and it is a green circle-dot

### AC7: Someone in no items shows all grey
Given "Jo Newcomer" is in no roles
When I open the Overview
Then Jo's card shows "No parts yet" and 5 grey circles

### AC8: The dots sit at the bottom of the card
Given Sam's card
When I look at it
Then the dots are centred at the bottom, below the name, clash icon and pills, with clear space above them

### AC9: No running order, no dots
Given there is no saved running order
When I open the Overview
Then no card shows dots

### AC10: A failed casting load shows no dots
Given the cast loads but the roles or the running order can't be loaded
When I open the Overview
Then I see "Couldn't load the casting."
And no card shows dots

## Notes

- FRs: FR1, FR2, FR3, FR4, FR7, FR8
- Depends on: none.
- Icons: Font Awesome circle-dot and circle (ADR 0013); green and grey become named colour tokens with at least 3:1 contrast against the card.
- Out of scope: hover detail and the screen-reader summary (E1.S2), shrinking to fit phones (E1.S3).
