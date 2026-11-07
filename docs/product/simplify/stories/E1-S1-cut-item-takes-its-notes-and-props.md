---
id: simplify.E1.S1
title: Delete a cut item's scenery notes, props and props notes
epic: E1
status: ready
---

## Story

As someone on the production team, I want an item's scenery notes and props to go when the item is cut from the show, so that nothing about a cut item, including which cast members carry its props, is left behind.

## Acceptance criteria

### AC1: A cut item's scenery notes go
Given "Pirate Sketch" has scenery notes "Two flats and a mast"
When an admin removes Pirate Sketch from the running order and saves it
Then Pirate Sketch's scenery notes are no longer stored

### AC2: A cut item's props go
Given "Pirate Sketch" has a prop "Cutlass" carried by "Alex Smith"
When an admin removes Pirate Sketch from the running order and saves it
Then Pirate Sketch's props are no longer stored

### AC3: A cut item's props notes go
Given "Pirate Sketch" has props notes "Check the cutlass is blunt"
When an admin removes Pirate Sketch from the running order and saves it
Then Pirate Sketch's props notes are no longer stored

### AC4: Items still in the show keep theirs
Given "Pirate Sketch" and "Opening Number" both have scenery notes, props and props notes
When an admin removes Pirate Sketch and saves
Then Opening Number's scenery notes, props and props notes are unchanged

### AC5: Reset undoes a cut before it's saved
Given an admin has removed "Pirate Sketch" on the Running order page but not saved
When they choose Reset
Then Pirate Sketch is back in the running order with its scenery notes, props and props notes

### AC6: Leftovers from earlier cuts go on the next save
Given scenery notes, props and props notes stored for "Old Finale", an item cut before this release
When an admin next saves the running order, with or without other changes
Then Old Finale's scenery notes, props and props notes are no longer stored

## Notes

- FRs: FR1
- Depends on: none
- The release notes must say that cutting an item now deletes its scenery notes, props and props notes, and that the first save after release removes those of items cut earlier (PRD FR1, risks).
- Out of scope: building the clean-up from one list (E1.S5).
