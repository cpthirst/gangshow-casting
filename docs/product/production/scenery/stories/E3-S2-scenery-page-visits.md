---
id: production-scenery.E3.S2
title: Record visits to Scenery pages on the Usage page
epic: E3
status: done
---

## Story

As an admin, I want the Usage page to count visits to the Scenery pages, so that I can see whether the team uses them.

## Acceptance criteria

### AC1: A visit to a Scenery page is counted
Given "pat" opens the Scenery page for "Opening Number"
When an admin opens the Usage page
Then "Scenery pages" shows 1 use by 1 person
And pat's uses show "Scenery pages 1"
And "Item pages" doesn't count it

### AC2: The activity names the item's Scenery page
Given "pat" opened the Scenery page for "Opening Number"
When an admin opens the Usage page
Then the activity shows pat "opened Opening Number's Scenery page"

### AC3: An item gone from the running order is still listed
Given "pat" opened the Scenery page for "Cut Sketch", which was later removed from the running order
When an admin opens the Usage page
Then the activity shows pat "opened a Scenery page of an item no longer in the running order"

### AC4: Uploads, downloads and deletes aren't recorded
Given "pat" opens the Scenery page for "Opening Number"
When pat uploads, downloads and deletes a file on it
Then only pat's visit to the page is recorded

### AC5: An item that isn't found isn't recorded
Given "pat" opens the Scenery page for an item that isn't in the running order
When the page says the item isn't found
Then no visit is recorded

## Notes

- FRs: FR15
- Depends on: production-scenery.E2.S1
- Recorded as casting item page visits are: which item only, never its title or files (ADR 0023), under the existing `POST /api/usage` limit (ADR 0024), so no infra change.
- Refined at `write-story` (2026-10-29): the user chose a separate "Scenery pages" feature over counting the visits with "Item pages", so admins can tell the two apart.
