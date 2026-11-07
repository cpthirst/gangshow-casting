---
id: simplify.E5.S2
title: Let an admin start a new production by year
epic: E5
status: draft
---

## Story

As an admin, I want to start next year's production, so that the team can build the new show from scratch while this year's stays to look back on.

## Acceptance criteria

### AC1: An admin starts a production from the Productions page
Given the newest production is 2027
When an admin opens Productions in the menu and starts production "2028"
Then 2028 is listed, and everyone opens it from their next page load

### AC2: It starts empty
Given an admin has just started 2028
When anyone opens its Cast, Running order, Casting Items and Production overview
Then there's no cast, no saved running order, no casting, props, files, mics or notes

### AC3: Nothing carries over
Given 2027 has a cast, items and casting
When an admin starts 2028
Then 2027's data is unchanged and none of it appears in 2028

### AC4: The year must be new and later than the newest
Given productions 2027 and 2028
When an admin tries to start "2028", "2026" or "next year"
Then it isn't started, and the admin is told the year must be a four-digit year later than 2028

### AC5: Only admins can start one
Given "sam" has every permission but isn't an admin
When sam asks the API to start a production
Then the API refuses, and Productions isn't in sam's menu

### AC6: Nobody's access changes
Given "pat" has Stage before 2028 is started
When an admin starts 2028
Then pat still has Stage, in 2028 and in 2027

## Notes

- FRs: FR19, FR23
- Depends on: simplify.E5.S1
- Productions is a new admin-only page in the menu, listing each production by year; E5.S4 deletes past ones from it too (the maintainer chose this, 2026-11-07).
- Add a browser layout walk of the Productions page and its start form at 320px and 360px (agreed with the maintainer, 2026-11-07).
- Help and Welcome describe the new page (README too, if it lists pages).
- AC4's "later than the newest" follows from FR20 and FR21: an earlier year would be a past production, and so view only, from the moment it was started.
