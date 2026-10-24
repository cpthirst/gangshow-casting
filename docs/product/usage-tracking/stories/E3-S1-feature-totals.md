---
id: usage-tracking.E3.S1
title: Show totals for each page, view and export on the Usage page
epic: E3
status: done
---

## Story

As an admin, I want totals for each page, view and export, so that I can see at a glance which features the team uses most and which nobody uses.

## Acceptance criteria

### AC1: Each feature shows its uses and people
Given in the last 30 days "robin" opened Running order 3 times and "alex" opened it twice
When an admin opens the Usage page
Then the totals show Running order with 5 uses by 2 people

### AC2: Unused features are listed with none
Given nobody has exported to Word in the last 30 days
When an admin opens the Usage page
Then the totals list "Export: Word item overview" and "Export: Word casting sheets" with 0 uses by 0 people

### AC3: Every recorded kind of use has a total
Given an admin on the Usage page
Then the totals list every menu page, each Overview view, item pages and each export, once each, in a fixed order

### AC4: Sessions aren't counted as a feature
Given "robin" had 4 sessions and no page uses in the last 30 days
When an admin opens the Usage page
Then no feature total includes "robin"

### AC5: The totals fit a phone
Given an admin on a 320px-wide screen
When they open the Usage page
Then the totals don't scroll sideways

## Notes

- FRs: FR6
- Depends on: usage-tracking.E2.S1. Views, item pages and exports show 0 until E2.S2 and E2.S3 are done.
- Out of scope: charts (PRD Constraints), per-item totals.
