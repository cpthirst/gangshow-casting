---
id: production-image-gallery.E1.S2
title: Remove an image from the grid
epic: E1
status: ready
---

## Story

As someone who can change a department's page, I want a trash icon on each thumbnail, so that I can take an out-of-date image off an item as easily as any other file.

## Acceptance criteria

In each AC, "Opening Number" has these Scenery files: backdrop.png, build-list.pdf and set-plan.jpg.

### AC1: Someone who can change the page sees a trash icon on each thumbnail
Given someone with Stage opens Opening Number's Scenery page
Then each thumbnail has a trash icon, whose accessible name is "Remove set-plan.jpg" on set-plan.jpg's

### AC2: Nobody else sees it
Given someone with only Casting opens Opening Number's Scenery page
Then no thumbnail has a trash icon

### AC3: Removing asks first
Given someone with Stage is on Opening Number's Scenery page
When they choose set-plan.jpg's trash icon
Then the confirmation dialog asks "Remove set-plan.jpg? This can't be undone." with "Remove file" and "Cancel"

### AC4: Cancelling keeps the image
Given the dialog from AC3 is open
When they choose "Cancel"
Then set-plan.jpg's thumbnail is still there and nothing is deleted

### AC5: Confirming removes the image for everyone
Given the dialog from AC3 is open
When they choose "Remove file"
Then set-plan.jpg is deleted, its thumbnail goes, and backdrop.png's stays

### AC6: Removing the last image returns the page to one list
Given "Interval Act" has backdrop.png and cue-sheet.pdf
When someone with Stage removes backdrop.png
Then the Files section lists cue-sheet.pdf as a row, with no Images or Other Files heading

### AC7: An image already removed elsewhere says so
Given someone removed set-plan.jpg in another browser since the page loaded
When someone with Stage removes it here
Then the page says "set-plan.jpg isn't there any more." and catches up with storage

## Notes

- FRs: FR7, FR2
- Depends on: production-image-gallery.E1.S1
- The icon calls the delete a file row already has in `ItemFiles.vue` (production-scenery FR11), with its confirm, its 404 and its "Couldn't remove … Try again.", so AC3, AC5 and AC7 check that the thumbnail is wired to it, not the delete again. Who sees it comes from `canChange`, as the row's icon does.
- The icon sits in the thumbnail's corner, outside the control that opens the image, so choosing one never does the other. Each is at least 24 by 24 CSS pixels.
- Out of scope: the viewer (E2.S1).
