---
id: production-scenery.E2.S6
title: Delete an item's scenery files when it leaves the running order
epic: E2
status: done
---

## Story

As someone on the production team, I want an item's scenery files to go when the item is removed from the show, so that files for cut items don't linger in storage.

## Acceptance criteria

### AC1: Saving without an item deletes its files
Given "Cut Sketch" has "set-plan.pdf" and "backdrop.png"
When the running order is saved without "Cut Sketch"
Then both files are gone from file storage

### AC2: Nothing goes before the save
Given "Cut Sketch" has "set-plan.pdf"
When someone removes it from the running order, then chooses Reset before saving
Then "Cut Sketch" is back, with "set-plan.pdf"

### AC3: Other items keep their files
Given "Opening Number" has "set-plan.pdf" and "Cut Sketch" has "backdrop.png"
When the running order is saved without "Cut Sketch"
Then "Opening Number" still has "set-plan.pdf"

### AC4: A failed clean-up is repaired by the next save
Given saving without "Cut Sketch" couldn't delete its files
When the running order is next saved
Then "Cut Sketch"'s files are deleted

### AC5: A file put in storage for a removed item is cleaned up too
Given "Cut Sketch" was removed, and later a file was put in its folder directly in file storage
When the running order is next saved
Then that file is deleted

## Notes

- FRs: FR13
- Depends on: production-scenery.E2.S1
- Runs in the removal clean-up that already deletes a removed item's notes, roles and props after each save (running-order E3.S2). Since names aren't in the database, it works from file storage: any item folder in the production that isn't in the saved running order is deleted (AC5).
- No infra change: the data function may already delete scenery files and nothing else (`*/*/scenery/*`, production-scenery FR11), and a batch delete needs only that permission. Other departments' files under an item's folder are left alone.
- Refined at `write-story` (2026-10-29): the running order's remove question keeps naming only the roles and casting notes, by the maintainer's choice, though saving now deletes the item's scenery files too.
