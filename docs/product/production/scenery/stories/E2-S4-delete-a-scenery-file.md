---
id: production-scenery.E2.S4
title: Delete a scenery file
epic: E2
status: done
---

## Story

As someone on the Stage or Tech team, I want to delete a scenery file that's out of date, so that nobody builds from an old plan.

## Acceptance criteria

### AC1: Stage, Tech, Director and admins see a trash icon
Given "Opening Number" has "set-plan.pdf"
When someone with Stage, Tech or Director, or an admin, opens its Scenery page
Then the file's row has a trash icon, on its left

### AC2: Deleting asks to confirm, then deletes it for everyone
Given "pat" has Stage
When pat chooses the trash icon on "set-plan.pdf"
Then the page asks "Remove set-plan.pdf? This can't be undone."
And when pat confirms, the row goes, and the file is gone from file storage

### AC3: Cancelling keeps the file
Given "pat" has Stage
When pat chooses the trash icon on "set-plan.pdf" and cancels
Then the file is still there

### AC4: Anyone else sees no trash icon, and the API refuses them
Given "sam" has Casting only
When sam opens the Scenery page
Then no row has a trash icon
And the API refuses sam's delete with 403 saying "You can view the scenery, but not change it."

### AC5: A delete only reaches its own item
Given "pat" has Stage
When pat asks to delete "../Finale/curtain.pdf" from "Opening Number"
Then the API refuses it, and "Finale" still has "curtain.pdf"

### AC6: Deleting a file that's already gone
Given "set-plan.pdf" was deleted in another browser after the page loaded
When pat confirms deleting it
Then the page says it's gone, and the row goes

### AC7: The trash icon is named for its file
Given someone using a screen reader with Stage
When they reach the trash icon on "set-plan.pdf"
Then it's named "Remove set-plan.pdf"

## Notes

- FRs: FR5, FR7, FR11
- Depends on: production-scenery.E2.S1 (a file can be put in storage directly for tests)
- The delete route names Stage, Tech and Director.
- There's no history: a deleted file can't be brought back (PRD non-goals).
- The page says "Remove", not "Delete", to match the props page's "Remove prop" (maintainer's choice at review, 2026-10-29). The file is still deleted from storage for good.
- Done alongside, at the maintainer's request (2026-10-29): the grid of tiles became a list, one row per file as on the other item pages. Each row has the trash icon on the left, then the type icon as a column of its own, then the name, in full, and size. PRD FR7 follows.
