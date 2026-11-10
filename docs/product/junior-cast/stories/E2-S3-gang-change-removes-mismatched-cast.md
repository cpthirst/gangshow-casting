---
id: junior-cast.E2.S3
title: Changing an item's gang removes who no longer matches
epic: E2
status: ready
---

## Story

As an admin keeping the running order, I want changing an item's gang to take out of its roles anyone not in that gang, after I've seen who goes, so that no one stays cast in an item they won't be at.

## Acceptance criteria

### AC1: Saving lists who will be removed from which roles
Given "Pirate Sketch" is for the Senior gang
And its Lead "Captain" is "Sam Sample" (Scouts), and its Ensemble "Pirates" is "Alex Smith" (no section) and "Poppy Example" (Beavers)
When an admin sets Pirate Sketch's Gang to Junior and chooses Save
Then they're asked to confirm that saving removes Sam Sample from Captain and Alex Smith from Pirates
And Poppy Example isn't listed

### AC2: Going back saves nothing
Given the confirmation from AC1 is showing
When the admin goes back
Then no new running order version is saved
And Pirate Sketch's roles are unchanged, and the draft still shows its Gang as Junior

### AC3: Confirming removes them
Given the confirmation from AC1 is showing
When the admin confirms
Then Pirate Sketch's Gang is Junior
And Captain has no one cast, and Pirates has only Poppy Example

### AC4: No confirmation when no one is affected
Given "Grand Finale" is for the Senior gang and has only Scouts and Explorers cast
When an admin sets its Gang to Both and chooses Save
Then the running order saves with no confirmation about removals

### AC5: Their props go with them
Given "Alex Smith" carries the prop "Cutlass" in Pirate Sketch
When an admin saves Pirate Sketch as Junior and confirms
Then Alex Smith no longer carries the Cutlass

### AC6: Their mic channels are freed
Given "Sam Sample" has channel 4 in Pirate Sketch's mic plot
When an admin saves Pirate Sketch as Junior and confirms
Then channel 4 is free in Pirate Sketch

### AC7: The server removes them whatever the client does
Given Pirate Sketch's roles as in AC1
When a client saves a running order version with Pirate Sketch set to Junior, without asking anyone
Then Sam Sample is removed from Captain and Alex Smith from Pirates

### AC8: Other items' casting is untouched
Given "Sam Sample" is also cast in "Opening Number", which stays Senior
When Pirate Sketch is saved as Junior
Then Sam Sample is still cast in Opening Number

## Notes

- FRs: FR5, FR6, FR11
- Depends on: E2.S2 (the gang rule and the item's gang)
- Join the running order's existing save and Remove confirmations (`apps/web/src/utils/running-order.ts`) rather than adding a second dialog. A save that both cuts an item and changes another's gang asks once, naming both.
- AC5 and AC6 come from the clean-up every casting change already runs (Props carriers and the Mic plot follow casting). Check it runs after a gang change; don't test the clean-up again.
- The removal runs on the server after the version is saved, like the clean-up after a cut (AC7). Logs and errors never include names.
- Help's Running order entry says that changing an item's gang removes anyone not in that gang from its roles. Check its structure, not its wording.
- Out of scope: removing people when their own section changes (E2.S4), which reuses this story's removal.
