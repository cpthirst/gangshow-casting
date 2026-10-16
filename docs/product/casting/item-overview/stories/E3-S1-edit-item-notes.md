---
id: casting-item-overview.E3.S1
title: Edit and save an item's notes
epic: E3
status: done
---

## Story

As a member of the production team, I want to keep notes on an item from its casting page, so that decisions and reminders about the item stay with it.

## Acceptance criteria

### AC1: An item's page has a Notes section
Given the "Pirate Sketch" page
When I open it
Then I see a "Notes" section with a text field and a Save button

### AC2: Saved notes are kept
Given I type "Hook needs a hat change before the finale" in Pirate Sketch's notes
When I save, and later open the page again
Then the notes read "Hook needs a hat change before the finale"

### AC3: Notes survive a new running order
Given Pirate Sketch has notes
When a new running order is saved with Pirate Sketch moved
Then Pirate Sketch's page still shows its notes

### AC4: Notes are separate from the running order's Comments
Given Pirate Sketch's running-order Comments say "Smoke machine"
When I open its page
Then the Notes field is empty, and saving notes doesn't change the Comments

### AC5: Notes are limited to 500 characters
Given I type 501 characters into the notes
When I save
Then I see that notes can be up to 500 characters
And nothing is saved

### AC6: Clearing the notes removes them
Given Pirate Sketch has notes
When I clear the text and save
Then the item has no notes

### AC7: A stale save is refused
Given someone else saved Pirate Sketch's notes after I opened the page
When I save my notes
Then I'm told the notes were changed by someone else
And I see their current notes, and nothing of mine is saved

### AC8: A failed save keeps my text
Given saving can't reach the server
When I save my notes
Then I'm told they couldn't be saved
And my text is still in the field

## Notes

- FRs: FR8, FR10
- Depends on: casting-item-overview.E1.S1.
- Notes are kept per item id in their own local store, alongside the cast and roles, and are git-ignored. The shared schema is defined first (CLAUDE.md).
- Added on 2026-10-16 at the user's request. Free text could hold personal details; the user chose not to add a hint against that (PRD security NFR).
- Out of scope: showing notes on the Items list (E3.S2), formatting or history of edits.
