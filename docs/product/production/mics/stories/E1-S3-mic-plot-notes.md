---
id: production-mics.E1.S3
title: Keep Mic plot notes for each item
epic: E1
status: ready
---

## Story

As someone in the Tech team, I want notes on each item's Mic plot page, so that I can record things like "harmonies only on for songs" alongside the channels.

## Acceptance criteria

### AC1: Tech changes the notes
Given "Opening Number" has no Mic plot notes
When someone with Tech writes "Mics 19–24 on for songs only" under the channels and saves
Then everyone who opens the page sees that note under "Mic plot notes"

### AC2: Director and Admins can change them too
Given an account with Director only, and an Admin account
When either changes the Mic plot notes for "Opening Number"
Then the change is saved

### AC3: Everyone else can read but not change them
Given an account without Tech or Director
When they open the Mic plot page for "Opening Number"
Then they see the notes with no way to change them
And the API refuses a change from them, however it's made

### AC4: The notes leave with the item
Given "Old Sketch" has Mic plot notes
When it is removed from the running order and the running order is saved
Then its notes are deleted

## Notes

- FRs: FR8, FR11
- Depends on: production-mics.E1.S1
- Works as Scenery, SFX and Wardrobe notes do.
- Out of scope: showing the notes on the Overview (E3.S1) and in the workbook (E3.S2).
