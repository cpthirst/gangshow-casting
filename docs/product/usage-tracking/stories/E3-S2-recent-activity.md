---
id: usage-tracking.E3.S2
title: Show a recent activity list on the Usage page
epic: E3
status: done
---

## Story

As an admin, I want a list of recent sessions and uses, newest first, so that I can see what happened in a rehearsal week without adding up the counts.

## Acceptance criteria

### AC1: Activity is listed newest first
Given "robin" had a session at 19:00 on 20 October 2026 and then opened Running order at 19:01
When an admin opens the Usage page
Then the activity list shows "robin, opened Running order, 20 October 2026 19:01" above "robin, session, 20 October 2026 19:00"

### AC2: An item use shows the item's title
Given "robin" opened the page of the item "Night at the movies" in production 2027
When an admin opens the Usage page
Then that activity reads "opened Night at the movies"

### AC3: An item no longer in the show is still listed
Given "robin" opened an item's page, and the item has since been removed from the running order
When an admin opens the Usage page
Then that activity reads "opened an item no longer in the running order"

### AC4: A long list shows the newest first, with a way to see more
Given more than 50 sessions and uses in the last 30 days
When an admin opens the Usage page
Then the list shows the newest 50
And the admin can show the next 50

### AC5: An empty list explains itself
Given no sessions or uses in the last 30 days
When an admin opens the Usage page
Then the activity list says there's no activity in this period

### AC6: Times are shown in UK time
Given a session recorded at 18:00 UTC on 20 October 2026
When an admin opens the Usage page
Then it shows 19:00 on 20 October 2026

### AC7: The activity list fits a phone
Given an admin on a 320px-wide screen
When they open the Usage page
Then the activity list doesn't scroll sideways

## Notes

- FRs: FR7
- Depends on: usage-tracking.E2.S1. AC2 and AC3 need E2.S2's item uses.
- AC6: the team is in Chester, so UK time (BST or GMT as it applies).
- AC4: the API sends at most the newest 1,000 activities in the range, which keeps its answer well inside a Lambda response's 6 MB. That's far more than a month's use by about 30 accounts.
- Out of scope: filtering the list by person or feature.
