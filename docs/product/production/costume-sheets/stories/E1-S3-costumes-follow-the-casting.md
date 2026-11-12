---
id: production-costume-sheets.E1.S3
title: Costumes follow the casting
epic: E1
status: done
---

## Story

As someone on the Wardrobe team, I want the costume rows to follow the casting and never lose a colleague's save, so that a recast or a cut needs no tidying from me and no one overwrites what someone else just wrote.

## Acceptance criteria

### AC1: A stale save is refused and shows the current text
Given "kit" and "dee" both have Alex Morgan's "Captain Hook" row open to edit, and dee saves From Wardrobe "Blue coat"
When kit saves From Wardrobe "Red coat, hook"
Then kit's save is refused, the form says someone else saved first and shows "Blue coat", and kit can edit again from there
And the API answers that save with 409 and the row's current costume

### AC2: A recast shows the new cast member's empty row
Given Alex Morgan as "Captain Hook" in "Opening Number" has From Wardrobe "Red coat, hook"
When "Captain Hook" is recast to Chris Evans
Then the Wardrobe page shows "Captain Hook" with Chris Evans and empty fields, and Alex Morgan's text is no longer shown anywhere

### AC3: Recasting the original person back brings their text back
Given Alex Morgan's "Captain Hook" text is hidden after a recast to Chris Evans
When "Captain Hook" is recast to Alex Morgan again
Then their row shows From Wardrobe "Red coat, hook" as before

### AC4: Removing a role removes its costumes
Given "Pirates" in "Opening Number" has filled-in rows for Jo Brown and Kim Lee
When "Pirates" is removed from the item
Then the Wardrobe page shows no "Pirates" rows, and the API's costume list for "Opening Number" has none for "Pirates"

### AC5: Deleting a cast member removes their costumes
Given Jo Brown has filled-in rows in "Opening Number" and "Finale"
When Jo Brown is deleted from the cast
Then the API's costume lists for both items have no row for Jo Brown, and nothing else about those items changes

### AC6: Renaming a role keeps its rows
Given Alex Morgan's "Captain Hook" row has From Wardrobe "Red coat, hook"
When "Captain Hook" is renamed "Hook"
Then the row shows "Hook" with Alex Morgan and From Wardrobe "Red coat, hook"

## Notes

- FRs: FR7, FR8
- Depends on: production-costume-sheets.E1.S2
- The stale check follows the item notes and roles: a revision sent with the save, refused with the current record (production-props FR20).
- Cast member deletion leaves no trace (ADR 0010): the costume store joins what removing a cast member already clears, in both the file and Dynamo stores.
- A role's rows are keyed by the role's id, so a rename changes nothing in them (PRD assumption).
- Out of scope: the export (E2.S2), Help (E3.S1).
