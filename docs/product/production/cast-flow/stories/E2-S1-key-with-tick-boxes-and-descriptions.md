---
id: production-cast-flow.E2.S1
title: Show and hide places from the key
epic: E2
status: ready
---

## Story

As a stage manager, I want to tick places on and off in the graph's key, and see what each place means, so that I can focus on the wings and holding area without the Dressing Room line dwarfing them.

## Acceptance criteria

### AC1: The key lists the four places, with only On-stage and Standby ticked
Given the 2027 production's Cast flow page
When it opens
Then the key lists On-stage, Standby, Backstage and Dressing Room
And On-stage and Standby are ticked, and Backstage and Dressing Room are not
And only the On-stage and Standby lines show

### AC2: Ticking a place shows its line
Given the page as it opens
When someone ticks Dressing Room
Then the Dressing Room line shows
And the On-stage and Standby lines still show

### AC3: Unticking it again hides the line
Given Dressing Room is ticked
When someone unticks it
Then the Dressing Room line is hidden

### AC4: The scale fits the lines shown
Given the Dressing Room line peaks at 50 and the others never pass 15
When the page opens
Then the side scale fits the lines shown, up to about 15, not 50
And when someone ticks Dressing Room, the scale grows to fit it

### AC5: With every place unticked, the key stays
Given all four places are unticked
When someone looks at the page
Then the graph shows no lines and the key still lists all four places, so any can be ticked again

### AC6: Each place has its description beside its name
Given the Cast flow page
When it opens
Then the key shows beside each place:
- On-stage: "Performing in the item that's running."
- Standby: "In the wings, from 4 minutes before their item."
- Backstage: "In the holding area for props, mics and quick changes, from 6 minutes before their item."
- Dressing Room: "Everyone else on the cast list."

### AC7: A screen reader reads the description with the tick box
Given someone using a screen reader
When they move to the Backstage tick box
Then it is announced with its name and its description

### AC8: The tick boxes work from the keyboard
Given the page as it opens
When someone tabs to Standby and presses Space
Then the Standby line is hidden

### AC9: Lines differ by more than colour
Given the Cast flow page
When it opens
Then each place's line has its own line style or point marker as well as its own colour, and the key shows the same for each

### AC10: Opening the page again starts from the same ticks
Given someone has ticked Dressing Room and unticked Standby
When they reload the page, or leave it and open it again
Then On-stage and Standby are ticked, and Backstage and Dressing Room are not

### AC11: Help describes Cast flow
Given the Help page
When someone opens it
Then it has an entry for Cast flow describing the four places with the same descriptions as the key, the 5-minute length assumed for untimed items, and that the counts are estimates

## Notes

- FRs: FR12, FR13, FR16
- Depends on: E1.S3
- AC6's wording is the requirement (PRD FR13), so it's asserted exactly. The descriptions live in one list with each place's name and line style, which the key and Help both read (AC11 checks Help's structure and that it uses that list, not its wording). The 4- and 6-minute figures in the descriptions come from the same values the counting uses.
- The key's descriptions are the page's only explanatory text (PRD FR16). This is an agreed exception to CLAUDE.md's "Let the layout explain itself".
- The key is part of the page, not the charting library's own legend, if that's what it takes to get real, labelled tick boxes.
- Which places are ticked isn't remembered: On-stage and Standby are ticked, and Backstage and Dressing Room unticked, whenever the page opens or reloads (FR12). The product owner chose this (2026-11-10) so the wings, where crowding matters most, aren't dwarfed by the Dressing Room on opening. Which places start ticked is said once, in the list of places.
- Colours must meet contrast against the page in light and dark themes.
- At phone widths the key may wrap below the graph; the page must not scroll sideways.
- Out of scope: hover and the table (E2.S2).
