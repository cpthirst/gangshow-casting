---
id: simplify.E1.S5
title: Remove every kind of per-item data when an item is cut
epic: E1
status: done
---

## Story

As the maintainer, I want cutting an item to remove every kind of data kept per item, from one list, so that a new kind of item data can't be left behind by mistake.

## Acceptance criteria

### AC1: Everything about a cut item goes
Given "Pirate Sketch" has casting, casting notes, props, props notes, scenery files and notes, SFX files and notes, Wardrobe files and notes, and a mic plot with Mic plot notes
And "Opening Number" has the same
When an admin removes Pirate Sketch from the running order and saves it
Then none of Pirate Sketch's data is stored any more
And all of Opening Number's is unchanged

### AC2: A new kind of item data can't be forgotten
Given a new kind of data kept per item is added to the data the API stores, locally or in the remote table
When it isn't added to what a cut removes
Then the gate fails, naming the kind that's missing

### AC3: A failed clean-up doesn't lose the save
Given removing one kind of data for a cut item fails
When an admin saves the running order
Then the new running order is saved, as today

### AC4: A failed clean-up of one kind doesn't stop the others
Given removing Pirate Sketch's props fails
When an admin removes Pirate Sketch from the running order and saves it
Then Pirate Sketch's casting, notes, files and mic plot are no longer stored
And the next save removes its props

## Notes

- FRs: FR5
- Depends on: simplify.E1.S1 (done)
- Audit before this story: a cut already removed every kind the API keeps per item (casting roles, casting notes, props, props notes, scenery/SFX/Wardrobe files, their notes, mic plot, Mic plot notes), in both the file and the `dynamo-` stores and the file folder/bucket. Nothing was missing, so this story is about building the clean-up from one list, not fixing a gap.
- Assumption: "the data the API stores" is every store in the API's set of stores (`Stores`, both the file and remote versions) plus each file department's store. All of them are per item except the show-wide ones, the running order and the cast list (and the cast-removal step built on them), which are named once as exceptions. Anything else counts as per-item data and joins the clean-up automatically; a new store that can't be cleaned up per item fails the typecheck until it's either given that ability or named show-wide. Usage isn't in `Stores` (ADR 0023) and isn't per item.
- Assumption: AC2's "gate fails, naming the kind" is met in three ways, all in `pnpm check`: the AC1 test expects a count for every kind the clean-up lists, so a new store that the test doesn't seed and count fails by name; a unit test checks that the clean-up holds every store but the show-wide ones (named once, in `showWideStores`); and the typecheck fails for a per-item store that can't keep only some items.
- Assumption: AC4 is new behaviour. Today one failing kind stops the clean-up of the kinds after it until the next save. Now each kind is removed independently and each failure is logged, naming the kind but no stored data (ADR 0010).
- AC3 is today's behaviour: the save logs a failed clean-up, and the next save finishes the job (`save-running-order.ts`).
- No new AWS permission: the API already deletes a cut item's files from the bucket (ADR 0030).
- Out of scope: the Running order page's Remove confirmation naming everything a save takes (follow-up from E1.S1).
