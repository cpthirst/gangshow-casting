---
id: production-overview.E2.S3
title: Show a count for each department on the Overview
epic: E2
status: draft
---

## Story

As someone on the production team, I want each item on the Overview to show how many scenery files and props it has, with a column for every department, so that I can see at a glance which items still need something.

## Acceptance criteria

### AC1: A count column for each department, in button order
Given the Overview lists "Opening Number"
When anyone opens it
Then after the item's title there are columns headed Scenery, Props, SFX, Mic plot and Wardrobe, in that order

### AC2: Scenery shows the item's file count, with "files" small underneath
Given "Opening Number" has 9 scenery files, and "Finale" has 1
When anyone opens the Overview
Then Opening Number's Scenery cell shows "9" with "files" written small underneath
And Finale's shows "1" over "file"

### AC3: A file put in storage outside the app is counted
Given "Opening Number" has 2 scenery files
And a third is put straight into file storage under the item's scenery folder
When anyone opens the Overview again
Then Opening Number's Scenery cell shows "3"

### AC4: Props shows its count the same way
Given "Pirate Sketch" has 3 props
When anyone opens the Overview
Then its Props cell shows "3" with "props" written small underneath, where it showed a bare "3" before

### AC5: None shows 0
Given "Finale" has no scenery files and no props
When anyone opens the Overview
Then its Scenery cell shows "0" over "files" and its Props cell "0" over "props"

### AC6: Departments still to come show a dash
Given the SFX, Mic plot and Wardrobe pages say "Coming soon"
When anyone opens the Overview
Then every item's SFX, Mic plot and Wardrobe cells show a dash
And a screen reader hears "Coming soon" for each, not "dash"

### AC7: Screen readers hear each count as one phrase
Given "Opening Number" has 9 scenery files and 3 props
When someone using a screen reader reads its row
Then they hear "9 scenery files" and "3 props", not a number and a word apart

### AC8: Counts only reach the item's own files and the production's own items
Given "Opening Number" and "Finale" each have scenery files
And a file is nested in a folder below an item's scenery folder
When the Overview asks for the production's scenery counts
Then each item is counted from its own scenery folder only, and the nested file isn't counted

### AC9: Anyone signed in can see the counts, nobody signed out
Given "sam" has Casting only, and someone else isn't signed in
When each asks for the production's scenery counts
Then sam gets them
And the one not signed in is refused

### AC10: A failed scenery count doesn't hide the items
Given the scenery counts can't be loaded
When anyone opens the Overview
Then the items and their props counts still show
And the page says "Couldn't load the scenery counts."
And the Scenery cells are empty, never "0"

### AC11: Fits a phone
Given the Overview at 320px and 360px wide
When it shows the five count columns
Then nothing scrolls sideways

## Notes

- FRs: FR4 (amended), FR14
- Depends on: production-overview.E2.S2; production-scenery.E2.S1 (scenery files in storage).
- Readings agreed with the maintainer (2026-10-29): all five columns now, with a dash for departments still "Coming soon"; zero shows as "0"; Props gains the small word to match Scenery.
- The API gains one read route giving every item's scenery file count for the production, from one listing of the production's folder in file storage, so the Overview doesn't ask once per item. Open to every signed-in role, like the files list (production-scenery FR7).
- Each later department (SFX, Mic plot, Wardrobe) replaces its dash with its own count, and its own word, in its feature's stories.
- AC11 is covered by the existing browser layout walk of the Overview at 320px and 360px (ADR 0011), which already runs; no new browser test.
- Size: likely near the ~400-line guideline (a route with both stores, and the page's columns). If it runs over, split the Props wording and the dashes (AC4–AC6) into a story of their own.
- Counting lists the whole production's folder rather than one item's, so ADR 0030 (Listing) gains an amendment when this is built.
- Out of scope: counts in Generate Props List; Help describing the columns (FR12, a later Help story if wanted).
