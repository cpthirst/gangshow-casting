---
id: production-cast-flow.E1.S1
title: Add the Cast flow page with a sample graph
epic: E1
status: done
---

## Story

As a stage manager, I want a Cast flow page under Production that draws a line graph of the show, so that I can see the shape of what it will show before it's worked out from our real show.

## Acceptance criteria

### AC1: Cast flow is in Production's menu, after Overview
Given a signed-in team member, whatever their permissions
When they open the menu
Then Production's group lists Overview, then Cast flow

### AC2: The page opens from the menu
Given a signed-in team member with no department permissions
When they choose Cast flow in the menu
Then the Cast flow page opens, titled "Cast flow"

### AC3: The page draws a line graph of the sample show
Given the Cast flow page
When it opens
Then it shows a line graph with clock times along the bottom and the number of people up the side
And it has four lines, On-stage, Standby, Backstage and Dressing Room, each in its own colour, all against the same scale

### AC4: A visit is recorded for the Usage page
Given a team member opens the Cast flow page
When an admin then opens the Usage page
Then the visit is listed against Cast flow, as visits to other menu pages are

## Notes

- FRs: FR1, FR2, FR9, FR10
- Depends on: none
- **ADR first.** Before the charting library is added, record an ADR (`adr` skill) choosing it. The product owner asked for a well-known, popular library that works well with Vue. Compare Chart.js (with vue-chartjs) and Apache ECharts (with vue-echarts) on bundle size, accessibility, theming (light and dark) and phone widths. The ADR is part of this story's PR.
- **Sample data.** The graph draws fixed, made-up numbers kept in the code, shaped like the real data E1.S2 will produce (clock times, and a count per place at each). No running order, roles or cast are read yet. E1.S2 deletes the sample. Main stays releasable, but a release between this story and E1.S2 would show the team made-up numbers, so either hold releases until E1.S2 is merged or build E1 in one batch.
- The page and its menu entry join the shared menu and route list. The Usage page's list of menu pages gains Cast flow in the one list everything reads, so this changes `packages/shared` (security-reviewer runs).
- Opening the page needs only sign-in, as Production's Overview does. Signed-out access is already refused by the app's sign-in; check it's wired up, don't test it again.
- The page has no tagline or explanatory line (FR16 puts the explanation in Help, in E2.S1).
- The graph must not make the page scroll sideways at 320px. It may shrink or scroll within itself. Offer to add the page to the browser layout walk; don't add it unasked.
- Out of scope: real counts (E1.S2), item markers (E1.S2), the key's tick boxes and descriptions (E2.S1), the table and keyboard focus (E2.S2), Help's content (E2.S1).
- **Brought forward from E2.S2 by the product owner (2026-11-10):** hovering over, clicking or tapping the graph shows the clock time and every place's count then, with Chart.js's own tooltip. The side starts at 0, never below. Help has a placeholder entry (title and summary) so the page can use the shared title row; E2.S1 fills it in.
