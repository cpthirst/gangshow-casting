---
id: production-sfx-wardrobe.E2.S1
title: Show SFX and Wardrobe on the Overview and the Usage page
epic: E2
status: ready
---

## Story

As someone on the production team, I want the Overview to show each item's SFX and Wardrobe files and notes, and an admin to see visits to those pages on the Usage page, so that I can see at a glance what each item has, and admins can see whether the pages are used.

## Acceptance criteria

### AC1: The SFX and Wardrobe columns count files
Given "Opening Number" has 3 SFX files and 1 Wardrobe file, and "Finale" has none
When anyone signed in opens the Overview
Then "Opening Number" shows "3" over "files" under SFX and "1" over "file" under Wardrobe
And "Finale" shows "0" in both, not a dash
And the Mic plot column still shows a dash

### AC2: Screen readers hear each count as one phrase
Given "Opening Number" has 3 SFX files and 1 Wardrobe file
When someone using a screen reader reaches its counts
Then they hear "3 SFX files" and "1 wardrobe file"

### AC3: SFX and Wardrobe notes appear under the item's row
Given "Opening Number" has scenery, props, SFX and Wardrobe notes
When anyone opens the Overview
Then all four appear in full under its row, each labelled, in the order Scenery, Props, SFX, Wardrobe
And an item with no notes shows nothing extra

### AC4: Visits to SFX and Wardrobe pages are counted
Given "lee" opens the SFX page and the Wardrobe page for "Opening Number"
When an admin opens the Usage page
Then "SFX pages" and "Wardrobe pages" each show 1 use by 1 person, apart from "Scenery pages" and "Item pages"
And the activity shows lee "opened Opening Number's SFX page" and "opened Opening Number's Wardrobe page"

### AC5: Only visits are recorded
Given "lee" opens the SFX page for "Opening Number"
When lee uploads, plays, downloads and deletes files on it, or opens one for an item that isn't found
Then only the visit to the found item's page is recorded

## Notes

- FRs: FR10, FR11, FR13
- Depends on: production-sfx-wardrobe.E1.S2
- Visits are recorded as Scenery's are: which item only, never its title or files (ADR 0023), under the existing usage limits (ADR 0024).
- An item gone from the running order is listed in the activity as Scenery's are (production-scenery.E3.S2 AC3).
- Out of scope: the SFX List (Word) export (PRD non-goals).
