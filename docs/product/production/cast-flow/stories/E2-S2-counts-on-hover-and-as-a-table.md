---
id: production-cast-flow.E2.S2
title: Read the counts on hover and in a table
epic: E2
status: ready
---

## Story

As a stage manager, I want to read the exact counts at any moment and at each item's start, with or without seeing the graph, so that I know how many people to expect in the wings and holding area.

## Acceptance criteria

The examples use the 2027 production from E1.S3: 1 "Opening" at 19:00, 2 "Campfire Sketch" at 19:10, 3 "Gang Song" at 19:15, and, after the interval, 1 "Finale" at 19:45, with 60 on the cast list.

### AC1: Hovering over any graph shows every count then
Given the Cast flow page
When someone hovers over any of the four graphs at 19:12
Then they see 19:12, that Campfire Sketch is running, and the count in each of the four places: On-stage 4, Standby 13, Backstage 0, Dressing Room 43

### AC2: Hovering over an item's marker shows its start
Given the Cast flow page
When someone hovers over Gang Song's marker
Then they see Gang Song, 19:15, and the count in each of the four places at 19:15

### AC3: Before curtain up and in the interval are named as such
Given the Cast flow page
When someone hovers over a graph at 18:58, and then at 19:30
Then they see "Before curtain up" at 18:58 and "Interval" at 19:30 in place of an item

### AC4: The same counts show on keyboard focus
Given someone using only the keyboard
When they move focus to Gang Song's marker
Then they see the same as when hovering over it

### AC5: A table lists the counts at each item's start
Given the Cast flow page
When it opens
Then below the graphs a table lists every item in running order, with its number, title, start time, and the count in each of the four places at its start
And Gang Song's row reads 3, Gang Song, 19:15, On-stage 13, Standby 0, Backstage 0, Dressing Room 47

### AC6: An item not in the printed programme has no number in the table
Given "Scene Change Song" isn't in the printed programme
When someone looks at the table
Then its row's number is blank and its title is shown

## Notes

- FRs: FR11
- Depends on: E2.S1, whose stacked graphs each show only their own place on hover (its AC6). This story widens that to every place and the item running, on whichever graph is hovered.
- E1.S1 already shows each place's count and the clock time on hovering over, clicking or tapping the graph (Chart.js's tooltip, `interaction` mode `index`). This story adds the item, keyboard focus, the markers and the table on top of it.
- The item marks along the top (E1.S2) draw every item's number and name, tilting up to upright where they don't fit side by side, which takes height from the graph on a phone. The product owner left any further crowding for this story (2026-11-10): settle it with the markers' hover, for example by shortening long names on the axis and naming the item in full on hover.
- The counts on hover and in the table come from the same counting as the graph, never a second calculation.
- If the charting library's tooltip can't be reached by keyboard (AC4), the item markers or the table rows give the same information to keyboard users; the ADR from E1.S1 should have weighed this.
- AC5's example: at 19:15 Gang Song's 13 (its 12 plus Robin Madeup) are on stage, and no one is called yet, since Finale's calls start at 19:39.
- AC1's counts: at 19:12 Campfire Sketch's 4 are on stage, and Gang Song's 13 are in Standby (from 19:11).
- The table uses the app's existing table style. At phone widths it may scroll within itself; the page must not scroll sideways.
- Out of scope: export or print (PRD non-goal).
