---
id: usage-tracking.E3.S3
title: Choose the Usage page's date range
epic: E3
status: ready
---

## Story

As an admin, I want to choose whether the Usage page covers the last 7, 30 or 90 days, so that I can look at this week's rehearsals or the whole season.

## Acceptance criteria

### AC1: The page opens on the last 30 days
Given an admin
When they open the Usage page
Then "Last 30 days" is chosen

### AC2: Choosing a range changes every part of the page
Given "robin" had a session 10 days ago and one 2 days ago, and opened Cast 10 days ago
When the admin chooses "Last 7 days"
Then "robin" shows 1 session and no Cast use in the summary
And Cast's total shows 0 uses
And the activity list shows only the session 2 days ago

### AC3: The last 90 days show everything kept
Given "robin" had a session 60 days ago
When the admin chooses "Last 90 days"
Then that session is counted and listed

### AC4: Only the offered ranges are accepted
Given an admin
When the usage data is requested for a range other than 7, 30 or 90 days, such as 365 days
Then the request is refused as invalid

### AC5: The range choice works with a keyboard and a screen reader
Given an admin using only a keyboard and a screen reader
When they reach the range choice
Then it's announced with its name and the chosen range, and they can change it with the keyboard

## Notes

- FRs: FR8
- Depends on: usage-tracking.E3.S1, usage-tracking.E3.S2
- The page needn't remember the choice. It opens on 30 days each time.
- Out of scope: custom dates, ranges longer than the 90 days kept.
