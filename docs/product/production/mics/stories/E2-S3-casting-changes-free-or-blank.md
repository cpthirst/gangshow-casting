---
id: production-mics.E2.S3
title: Keep the mic plot in step with casting
epic: E2
status: ready
---

## Story

As someone in the Tech team, I want the mic plot to follow casting changes, so that a mic is never left on someone who is no longer in the item, or on a part they no longer play.

## Acceptance criteria

### AC1: Taking someone out of an item frees their channel there
Given Alex Morgan is on Mic 3 in "Space Sketch" and Mic 3 in "Finale"
When Alex is taken out of "Space Sketch" on the Casting pages
Then Mic 3 in "Space Sketch" is empty
And Mic 3 in "Finale" is still Alex's

### AC2: Removing someone from the cast frees all their channels
Given Alex Morgan is on mics in "Space Sketch" and "Finale"
When Alex is removed from the cast
Then those channels are empty in both items

### AC3: Removing a role leaves the cast member with the roles they still play
Given Mic 3 in "Space Sketch" is Alex Morgan, shown as "Alien 1", and Alex is still cast in the item as "Narrator"
When the role "Alien 1" is removed from "Space Sketch"
Then Mic 3 shows Alex Morgan as "Narrator"

### AC4: Recasting a role leaves the old cast member on the mic
Given Mic 3 in "Space Sketch" is Alex Morgan, shown as "Alien 1, Chorus"
When "Alien 1" is recast to Sam Patel, and Alex stays in the item
Then Mic 3 shows Alex Morgan as "Chorus"
And Sam Patel isn't given a mic

### AC5: Renaming a role follows on the mic
Given Mic 3 in "Space Sketch" is Alex Morgan as "Alien 1"
When the role is renamed "Alien Leader"
Then Mic 3 shows "Alien Leader"

## Notes

- FRs: FR9
- Depends on: production-mics.E1.S2
- If Alex is no longer in the item at all after a role change, AC1 applies and the channel is freed.
- Out of scope: running order changes (E2.S2, and the removal clean-up in E1.S1).
- 2026-11-03: E1.S2 now shows a mic's roles from the casting rather than saving one, so AC3 to AC5 follow from it; this story's own work is freeing channels (AC1, AC2) and checking those three still hold.
