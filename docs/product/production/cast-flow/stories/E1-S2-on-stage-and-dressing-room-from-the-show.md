---
id: production-cast-flow.E1.S2
title: Plot On-stage and Dressing Room from the show
epic: E1
status: done
---

## Story

As a stage manager, I want the Cast flow graph to count who is on stage and who is in the dressing rooms throughout our show, timed from the running order, so that I can see how the cast moves through the real show.

## Acceptance criteria

The examples use this made-up 2027 production. The running order starts at 19:00 with a 20-minute interval. First half: 1 "Opening" (10 minutes; an ensemble of 30), then 2 "Campfire Sketch" (no length set; a lead, Alex Example, and an ensemble of 5 that includes Alex). Second half: 3 "Finale" (8 minutes; an ensemble of 40). The cast list has 50 people.

### AC1: Cast in the running item are On-stage
Given the 2027 production
When someone opens Cast flow
Then from 19:00 to 19:10 the On-stage line is at 30

### AC2: Everyone else on the cast list is in the Dressing Room
Given the 2027 production
When someone opens Cast flow
Then from 19:00 to 19:10 the Dressing Room line is at 20
And at every time on the graph, On-stage and Dressing Room add up to 50, including the people cast in no item

### AC3: Someone in two roles of one item counts once
Given Alex Example plays the lead in Campfire Sketch and is also in its ensemble
When someone opens Cast flow
Then from 19:10 to 19:15 the On-stage line is at 5, not 6

### AC4: An untimed item counts as 5 minutes
Given Campfire Sketch has no length set
When someone opens Cast flow
Then Campfire Sketch runs from 19:10 to 19:15 on the graph

### AC5: The interval comes between the halves
Given the first half ends at 19:15 and the interval is 20 minutes
When someone opens Cast flow
Then the On-stage line is at 0 from 19:15 to 19:35
And Finale runs from 19:35 to 19:43

### AC6: The graph runs from curtain up to the end of the show
Given the 2027 production
When someone opens Cast flow
Then the time along the bottom starts at 19:00 and ends at 19:43

### AC7: Each item's start is marked with its number
Given the 2027 production
When someone opens Cast flow
Then the time axis marks 19:00 with "1", 19:10 with "2" and 19:35 with "1", each half numbered from 1 as the Running order page numbers it
And a faint dashed line runs up the graph from each mark, behind the place lines

### AC8: An item not in the printed programme is marked by its title
Given "Scene Change Song" is between Opening and Campfire Sketch and isn't in the printed programme
When someone opens Cast flow
Then its start is marked "Scene Change Song" rather than a number

### AC9: A running order change shows the next time the page opens
Given Cast flow showed Campfire Sketch starting at 19:10
When an admin saves Opening as 12 minutes long, and someone opens Cast flow again
Then Campfire Sketch starts at 19:12

### AC10: A casting change shows the next time the page opens
Given Cast flow showed 30 On-stage during Opening
When someone casts 2 more people in Opening's ensemble, and Cast flow is opened again
Then the On-stage line is at 32 during Opening

### AC11: It shows the current production
Given the 2026 and 2027 productions have different running orders
When someone switches to the 2026 production and opens Cast flow
Then the graph is the 2026 show's

### AC12: No saved running order
Given a production with no saved running order
When someone opens Cast flow
Then they see the same message and link the Production Overview shows when there's no running order, and no graph

### AC13: No cast
Given a production with a saved running order and nobody on its cast list
When someone opens Cast flow
Then they see that there's no cast yet, with a link to the Cast page, and no graph

### AC14: A failed load isn't shown as empty
Given the running order, roles or cast list can't be loaded
When someone opens Cast flow
Then they see the error the Production pages show when loading fails, not an empty state or a graph

### AC15: The interval is marked as the items are
Given the first half ends at 19:15
When someone opens Cast flow
Then the time axis marks 19:15 with "Interval", with the same faint dashed line up the graph

## Notes

- FRs: FR3, FR4, FR7, FR8, FR9, FR11, FR14, FR15
- Depends on: E1.S1
- The sample data from E1.S1 is deleted.
- Item times come from the running order's existing timing (the one the Running order page and the clash check use). There is no second way to time the show. Its rule for untimed items (5 minutes here) must be a single value that the timing and Help (E2.S1) both read.
- Counting who is where is plain logic, tested there with examples like those above. The page keeps one check that it's wired up.
- Only On-stage and Dressing Room are counted in this story. Standby and Backstage arrive in E1.S3; until then their lines are absent, so the two lines shown add up to the cast list (AC2).
- Uses only the running order, roles and cast list the web app already loads from the API: no new API route or data. Nothing is saved (FR14).
- The markers' lines were asked for by the product owner (2026-11-10): faint and dashed so the place lines stay the clearest thing on the graph. Chart.js can draw them as the x-axis grid lines at the marked times, with no plugin (ADR 0039).
- Out of scope: Standby and Backstage, and starting the graph at the first call (E1.S3); hover and the table (E2.S2).
- Follow-up: `apps/web/src/utils/casting.fixture.ts` holds `aRole` and `aCastMember` for these tests. Older tests still build their own (`utils/clashes.test.ts`, `utils/roles.test.ts`, `utils/props.test.ts`, `utils/mic-plot.test.ts`, `utils/cast.test.ts`, `utils/overview.test.ts`, `utils/word/casting-sheets-document.test.ts`, `pages/CastingItemsPage.test.ts`, `pages/CastingItemPage.test.ts`, `pages/PropsItemPage.test.ts`, `pages/MicPlotItemPage.test.ts`, `pages/ProductionOverviewMicPlotExport.test.ts`); moving them onto it is a separate chore.
