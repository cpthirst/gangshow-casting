---
feature: production-cast-flow
status: approved
prd: ./prd.md
---

# Cast flow: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | See how many of the cast are in each of the four places across the whole show, on a line graph timed from the running order | FR1–FR11, FR14, FR15 |
| E2 | Read the graphs: a graph for each place, what each place means, and the counts without the graph | FR10, FR11, FR13, FR16 |

## E1: The Cast flow graph

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-cast-flow.E1.S1](stories/E1-S1-cast-flow-page-skeleton.md) | Walking skeleton. An ADR picks the charting library and it's added. Production's menu gains Cast flow after Overview, open to every role and recorded on the Usage page. The page draws the line graph (clock time along the bottom, people up the side, one coloured line per place) from fixed, made-up sample data in the code: no running order, roles or cast are read yet | FR1, FR2, FR9, FR10 | (none) | done |
| [production-cast-flow.E1.S2](stories/E1-S2-on-stage-and-dressing-room-from-the-show.md) | The sample data goes. The graph plots On-stage and Dressing Room counts for the current production, timed from the latest saved running order (untimed items count as 5 minutes, the interval included) and counted from its roles and cast list, with each item's start, by its number and name, and the interval's, marked on the time axis and by a faint dashed line up the graph. Worked out afresh on every visit; the shared empty state when there's no running order or cast | FR3, FR4, FR7, FR8, FR9, FR11, FR14, FR15 | E1.S1 | done |
| [production-cast-flow.E1.S3](stories/E1-S3-standby-and-backstage-calls.md) | Standby (from 4 minutes before an item) and Backstage (from 6 minutes before) join the graph as their own lines. Nearest the stage wins when places overlap, so back-to-back cast go straight to Standby or stay On-stage, and the calls for the first item after the interval start during it. The graph begins at the first call before curtain up | FR3, FR5, FR6, FR8, FR9, FR10 | E1.S2 | done |

## E2: Reading the graphs

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-cast-flow.E2.S1](stories/E2-S1-key-with-tick-boxes-and-descriptions.md) | A graph for each place, stacked top to bottom On-stage, Standby, Backstage, Dressing Room, sharing one time axis and one people scale, each with its own clock times and item marks (long labels cut short with "…"). Each is headed by its place's name and a one-line description, which Help reads from the same list (rewritten 2026-11-10: one graph was too cluttered, so the tick boxes went) | FR10, FR13, FR16 | E1.S3 | done |
| [production-cast-flow.E2.S2](stories/E2-S2-counts-on-hover-and-as-a-table.md) | Hovering over or focusing an item's marker or a point on any graph shows the item and each place's count at that time. The counts at each item's start can also be read without the graphs, as a table a screen reader reaches | FR11 | E2.S1 | done |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E1.S2, E1.S3 |
| FR4 | E1.S2 |
| FR5 | E1.S3 |
| FR6 | E1.S3 |
| FR7 | E1.S2 |
| FR8 | E1.S2, E1.S3 |
| FR9 | E1.S1, E1.S2, E1.S3 |
| FR10 | E1.S1, E1.S3, E2.S1 |
| FR11 | E1.S2, E2.S2 |
| FR12 | Dropped |
| FR13 | E2.S1 |
| FR14 | E1.S2 |
| FR15 | E1.S2 |
| FR16 | E2.S1 |
