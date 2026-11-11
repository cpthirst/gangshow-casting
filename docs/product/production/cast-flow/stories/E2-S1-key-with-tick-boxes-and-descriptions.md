---
id: production-cast-flow.E2.S1
title: A graph for each place, with what it means
epic: E2
status: done
---

## Story

As a stage manager, I want a separate graph for each place, stacked one above the other and each saying what it means, so that I can read the wings and the holding area at a glance without the other places' lines in the way.

## Acceptance criteria

The examples use the 2027 production from E1.S3: curtain up at 19:00, the first call at 18:54, Finale ending at 19:53, and 60 on the cast list. The Dressing Room peaks at 60, in the interval, and Standby at 40, just before Finale.

### AC1: Each place has its own graph, stacked in order
Given the 2027 production
When someone opens Cast flow
Then they see four graphs, one above the other: On-stage, Standby, Backstage, then Dressing Room
And each graph has one line, in its place's own colour

### AC2: Each graph is headed by its place and what it means
Given the Cast flow page
When it opens
Then each graph is headed by its place's name and its description:
- On-stage: "Performing in the item that's running."
- Standby: "In the wings, from 4 minutes before their item."
- Backstage: "In the holding area for props, mics and quick changes, from 6 minutes before their item."
- Dressing Room: "Everyone else on the cast list."

### AC3: The graphs share one time axis
Given the Cast flow page
When it opens
Then all four graphs run from 18:54 to 19:53, so the same time sits at the same point across the page
And each graph shows the clock times along its bottom

### AC4: Every graph shows the item marks
Given the Cast flow page
When it opens
Then each graph labels the item and interval marks along its top, with each mark's faint dashed line down the graph

### AC5: The graphs share one people scale
Given the Dressing Room peaks at 60 and Standby at 40
When someone opens Cast flow
Then every graph's side runs from 0 to the same top, at least 60, so a height means the same number of people in every graph

### AC6: Hovering over a graph shows its count then
Given the Cast flow page
When someone hovers over, clicks or taps the Standby graph at 19:12
Then they see 7:12 pm and Standby's count then, 13

### AC7: A screen reader names each graph by its place
Given someone using a screen reader
When they move to the Backstage graph
Then it is announced as the Backstage graph, with Backstage's description

### AC8: Help describes Cast flow
Given the Help page
When someone opens it
Then its Cast flow entry describes the four places with the same descriptions as the graphs' headings, the 5-minute length assumed for untimed items, and that the counts are estimates

### AC9: Long mark labels are cut short
Given Campfire Sketch is item 2
When someone opens Cast flow
Then its mark reads "2 Campfire…", cut to 10 characters and ended with "…"
And "1 Opening" and "Interval", which fit, are shown whole

## Notes

- FRs: FR10, FR13, FR16 (FR12, the tick boxes, was dropped with the stacked graphs)
- Depends on: E1.S3 (done)
- **Rewritten 2026-11-10 at the product owner's request.** One graph with four lines was too cluttered. A graph per place needs no tick boxes, no places ticked on opening and no line styles, so those ACs went.
- AC2's wording is the requirement (PRD FR13), so it's asserted exactly. The descriptions live in the one list of places, with each place's name and colour, which the headings and Help both read. AC8 checks Help's structure and that it uses that list, not its wording. The 4- and 6-minute figures in the descriptions come from the same values the counting uses.
- The headings' descriptions are the page's only explanatory text (PRD FR16), an agreed exception to CLAUDE.md's "Let the layout explain itself".
- The four graphs are drawn from the same counts and marks as now; only the layout changes. With its own clock times and marks, each graph is about 14rem tall, so on a laptop the page scrolls to reach the lower graphs; the product owner chose axes on every graph and didn't ask for the four to fit one screen. At phone widths the page must not scroll sideways.
- The product owner chose (2026-11-10) to repeat the clock times and the item marks on every graph, so each reads on its own, and to cut long mark labels so they crowd less. The item's full name comes with hover in E2.S2.
- Hovering shows only that graph's place (AC6). E2.S2 widens it to every place and the item running.
- Out of scope: the item on hover, keyboard focus on marks, and the table (E2.S2).
