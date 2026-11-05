---
id: production-mics.E3.S1
title: Show the Mic plot on the Overview and the Usage page
epic: E3
status: ready
---

## Story

As someone on the production team, I want the Overview to show how many mics each item uses and its Mic plot notes, and an admin to see visits to the Mic plot pages, so that I can see the mic load at a glance and admins can see whether the page is used.

## Acceptance criteria

### AC1: The Mic plot column counts allocated channels
Given "Opening Number" has 6 channels given out, "Link" has 1 and "Finale" has none
When anyone signed in opens the Overview
Then the Mic plot column shows "6" over "mics", "1" over "mic" and "0" over "mics", not a dash

### AC2: Screen readers hear the count as one phrase
Given "Opening Number" has 6 channels given out
When someone using a screen reader reaches its Mic plot count
Then they hear "6 mics"

### AC3: Mic plot notes appear under the item's row
Given "Opening Number" has scenery, props, SFX, Mic plot and Wardrobe notes
When anyone opens the Overview
Then all five appear under its row, each labelled, in the order Scenery, Props, SFX, Mic plot, Wardrobe
And an item with no notes shows nothing extra

### AC4: An item with a kept allocation that breaks the rule shows an Error icon
Given Mic 1 is Alex Morgan's in "Opening Number" and was kept as Sam Patel's in "Finale" after a reorder put "Finale" straight after it (E2.S2)
When anyone signed in opens the Overview
Then "Finale"'s Mic plot count shows an Error icon, the same icon as a casting clash
And when they hover over or focus it, they see "1 error: Mic 1"
And it is read out as the word "Error" followed by that description, and written out under the count on phones
And "Opening Number", and items without such an allocation, show no icon

### AC5: Visits to Mic plot pages are counted
Given "lee" opens the Mic plot page for "Opening Number"
When an admin opens the Usage page
Then "Mic plot pages" shows 1 use by 1 person, apart from the other department pages
And the activity shows lee "opened Opening Number's Mic plot page"

### AC6: Only visits are recorded
Given "lee" opens the Mic plot page for "Opening Number"
When lee gives out and clears channels, changes notes, or opens one for an item that isn't found
Then only the visit to the found item's page is recorded

## Notes

- FRs: FR10 (Overview error), FR12, FR13, FR16 (visits)
- Depends on: production-mics.E1.S3, production-mics.E2.S2 (the kept allocation and its error)
- A kept allocation that breaks the rule (E2.S2) still counts, and flags the item with an Error icon (AC4), as the Items list flags an item with a casting clash (casting-rules E3.S1), with the channels in place of people. Decided 2026-11-05 (user).
- Visits are recorded as the other department pages' are: which item only (ADR 0023), under the existing usage limits (ADR 0024).
- Out of scope: Generate Mic Plot and its usage (E3.S2).
