---
id: usage-tracking.E2.S2
title: Record Overview view switches and item pages, and count them per person
epic: E2
status: done
---

## Story

As an admin, I want to see which Overview views people switch to and how often they open an item, so that I know whether By item, the Grid and the item pages are worth their place.

## Acceptance criteria

### AC1: Switching the Overview's view is recorded
Given "robin" is on the Casting Overview, showing By person
When "robin" switches to Grid
Then a use "Overview: Grid" is recorded for "robin"

### AC2: Each view is recorded by name
Given "robin" is on the Casting Overview
When "robin" switches to By item, then Grid, then back to By person
Then the uses "Overview: By item", "Overview: Grid" and "Overview: By person" are recorded, in that order

### AC3: The view the page opens on isn't counted as a switch
Given "robin" is signed in
When "robin" opens the Casting Overview, which shows By person
Then only the page use "opened Casting Overview" is recorded, and no view use

### AC4: Opening an item's page is recorded with the item
Given production 2027 has an item "Night at the movies"
When "robin" opens "Night at the movies"'s page
Then a use "opened an item" is recorded for "robin", naming that item in production 2027

### AC5: The summary counts views and items per person
Given in the last 30 days "robin" switched to Grid twice and opened item pages 4 times
When an admin opens the Usage page
Then "robin"'s row shows Overview: Grid 2 and Item pages 4

### AC6: An item use can't name anything but an item
Given "robin" is signed in
When the app asks to record an item use whose item or production isn't a valid id
Then the request is refused as invalid
And nothing is recorded

### AC7: A failed recording doesn't get in the way
Given recording a use fails
When "robin" switches the Overview to Grid
Then the Grid shows as normal, with no error or notice about recording

## Notes

- FRs: FR2 (views and items), FR3, FR5
- Depends on: usage-tracking.E2.S1
- An item use records the item's production and id, never its title or anyone in its cast. E3.S2 shows the title from the running order.
- Out of scope: exports (E2.S3), per-item counts on the Usage page.
