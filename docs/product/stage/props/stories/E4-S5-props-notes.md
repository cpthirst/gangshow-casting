---
id: stage-props.E4.S5
title: Keep props notes for each item
epic: E4
status: ready
---

## Story

As someone on the props team, I want a notes field for each item's props, shown on the Props page too, so that reminders like "chest must be set before the blackout" are where everyone will see them.

## Acceptance criteria

### AC1: Stage saves props notes
Given pat, with Stage, is on Pirate Sketch's props page
When pat types "Chest set stage left before the blackout" in Props notes and saves
Then it says the notes were saved, and they're still there on reload

### AC2: Props notes are separate from casting notes
Given Pirate Sketch has the casting notes "Captain needs a sword fight rehearsal"
When pat saves props notes for Pirate Sketch
Then the item's casting page still shows only its casting notes, and the props page only its props notes

### AC3: Notes are at most 500 characters
Given pat is writing props notes
When the text is longer than 500 characters
Then it can't be saved, and pat is told the limit

### AC4: Clearing the notes removes them
Given Pirate Sketch has props notes
When pat clears the text and saves
Then the item has no props notes

### AC5: Someone else saved first
Given pat's page loaded Pirate Sketch's props notes, and since then someone else saved new ones
When pat saves
Then it's refused, and pat is told someone else saved them, and shown the current notes

### AC6: A failed save keeps the text
Given pat has typed props notes
When saving fails
Then pat is told, and the text is kept

### AC7: Notes survive a new running-order version
Given Pirate Sketch has props notes
When a new running-order version is saved with Pirate Sketch still in it
Then its props notes are still there

### AC8: The Props page shows each item's notes
Given Pirate Sketch has the props notes "Chest set stage left before the blackout", and Finale has none
When anyone opens the Props page
Then the notes appear in full under Pirate Sketch's row (at the bottom of its card on a phone), as item notes do on Casting Items
And nothing extra shows for Finale

### AC9: Without Stage the notes are read-only
Given "sam" has the Casting permission only
When sam opens Pirate Sketch's props page
Then sam sees the props notes but can't edit them
And the API refuses a props notes save from sam with 403 saying "You can view the props, but not change them."

## Notes

- FRs: FR14, FR20
- Depends on: stage-props.E4.S2
- Works like the casting item notes (casting-item-overview FR8 to FR10), and reuses their pieces where it can, but is stored apart, by item id, and needs Stage, not Casting.
- Props notes are free text, for the production team only, like the casting notes. Tests use made-up text.
- Out of scope: notes on individual props (PRD non-goal).
