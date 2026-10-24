---
id: usage-tracking.E2.S1
title: Record opening a menu page, and count it per person
epic: E2
status: ready
---

## Story

As an admin, I want to see which pages each person opens, so that I know which parts of the app the team relies on and which they don't use.

## Acceptance criteria

### AC1: Opening a menu page is recorded
Given "robin" is signed in
When "robin" opens the Running order page
Then a use "opened Running order" is recorded for "robin" at that time

### AC2: Every menu page is recorded, however it's reached
Given "robin" is signed in
When "robin" opens Welcome, Running order, Cast, Casting Overview, Casting Items, Accounts or Usage, from the menu, a link, a bookmark or by reloading
Then each opening is recorded as a use of that page

### AC3: Pages that aren't menu pages aren't recorded as menu pages
Given "robin" is signed in
When "robin" opens an address that doesn't exist, or signs out
Then no page use is recorded

### AC4: The summary counts each page per person
Given in the last 30 days "robin" opened Running order 3 times and Cast once, and "alex" opened nothing
When an admin opens the Usage page
Then "robin"'s row shows Running order 3 and Cast 1
And "alex"'s row shows no page use

### AC5: Only known uses are accepted
Given "robin" is signed in
When the app asks to record a use of a page that isn't in the menu, such as "Admin secrets"
Then the request is refused as invalid
And nothing is recorded

### AC6: A failed recording doesn't get in the way
Given recording a use fails
When "robin" opens the Cast page
Then the Cast page shows as normal, with no error or notice about recording

### AC7: Help isn't recorded
Given "robin" is on the Running order page
When "robin" opens its help
Then no use is recorded

## Notes

- FRs: FR2 (menu pages), FR3, FR5
- Depends on: usage-tracking.E1.S1
- A use is always recorded for the person signed in, as sessions are (E1.S1 AC4), and expires after 90 days like them.
- Recording uses is open to read-only members, like sessions (E1.S1 AC3).
- A reload counts as a page use, but not as a new session (PRD FR1, changed on 2026-10-24). Counts show rough use, not exact clicks (PRD Risks).
- The summary must still fit a 320px screen (E1.S1 AC15) as it grows.
- Out of scope: Overview views and item pages (E2.S2), exports (E2.S3).
