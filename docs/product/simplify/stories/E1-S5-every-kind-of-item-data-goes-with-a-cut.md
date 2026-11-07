---
id: simplify.E1.S5
title: Remove every kind of per-item data when an item is cut
epic: E1
status: draft
---

## Story

As the maintainer, I want cutting an item to remove every kind of data kept per item, from one list, so that a new kind of item data can't be left behind by mistake.

## Acceptance criteria

### AC1: Everything about a cut item goes
Given "Pirate Sketch" has casting, casting notes, props, props notes, scenery files and notes, SFX files and notes, wardrobe files and notes, and a mic plot with notes
When an admin removes Pirate Sketch from the running order and saves it
Then none of that is stored any more

### AC2: A new kind of item data can't be forgotten
Given a new kind of data kept per item is added to the data the API stores
When it isn't added to what a cut removes
Then the gate fails, naming the kind that's missing

### AC3: A failed clean-up doesn't lose the save
Given removing one kind of data for a cut item fails
When an admin saves the running order
Then the new running order is saved, as today

## Notes

- FRs: FR5
- Depends on: simplify.E1.S1
- AC3 is today's behaviour: the save logs a failed clean-up, and the next save finishes the job (`save-running-order.ts`).
