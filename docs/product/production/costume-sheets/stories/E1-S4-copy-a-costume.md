---
id: production-costume-sheets.E1.S4
title: Copy a costume to the item's other rows
epic: E1
status: done
---

## Story

As someone on the Wardrobe team, I want to copy one cast member's costume to everyone of the same role type in an item, or to everyone in it, so that I don't type the same costume out for a whole ensemble.

## Acceptance criteria

In each AC, "Opening Number" has Captain Hook (Lead: Alex Morgan), Pirates (Ensemble: Jo Brown, Kim Lee, Sam Patel) and Sailors (Ensemble: Chris Evans), and the viewer can change costumes.

### AC1: The copy buttons sit beside Save
Given kit is editing Jo Brown as Pirates
Then the form's buttons are "Save", "Copy to Ensemble", "Copy to all" and "Cancel", in that order

### AC2: Copy to a type only when someone else is that type
Given kit is editing Alex Morgan as Captain Hook, the item's only Lead
Then the form has "Copy to all" and no "Copy to Lead"

### AC3: Copy to a type only when it differs from Copy to all
Given an item whose roles are all Ensemble, with Jo Brown and Kim Lee in them
When kit edits Jo Brown's row
Then the form has "Copy to all" and no "Copy to Ensemble"

### AC4: No copy buttons with nobody to copy to
Given an item with Alex Morgan its only cast member
When kit edits Alex's row
Then the form has only "Save" and "Cancel"

### AC5: Copying asks first, saying it overwrites
Given kit is editing Jo Brown as Pirates
When kit chooses "Copy to Ensemble"
Then the confirmation dialog asks "Copy From Wardrobe and From Cast Member to the 3 other Ensemble costumes in this item? Anything already in them will be overwritten." with "Copy" and "Cancel"
And choosing "Copy to all" instead asks "Copy From Wardrobe and From Cast Member to all 4 other costumes in this item? Anything already in them will be overwritten."

### AC6: Cancelling copies nothing
Given kit has typed "Striped top" into Jo Brown's From Wardrobe and chosen "Copy to Ensemble"
When kit chooses "Cancel" in the dialog
Then nothing is saved and the form is still open with "Striped top"

### AC7: Copy to a type saves the row and overwrites the others of that type
Given Kim Lee as Pirates already has From Wardrobe "Old shirt" and Notes "Needs a belt"
And kit has typed From Wardrobe "Striped top", From Cast Member "Black boots" and Notes "Hem it" into Jo Brown's row
When kit chooses "Copy to Ensemble" and then "Copy"
Then Jo's row is saved with all three fields
And Kim Lee, Sam Patel and Chris Evans each have From Wardrobe "Striped top" and From Cast Member "Black boots", Kim keeping Notes "Needs a belt"
And Alex Morgan's row is unchanged, the form closes, and screen readers are told "Costume copied to 3 others."

### AC8: Copy to all reaches every other cast row
Given kit is editing Jo Brown as Pirates with From Wardrobe "Striped top"
When kit chooses "Copy to all" and then "Copy"
Then Alex Morgan, Kim Lee, Sam Patel and Chris Evans each have From Wardrobe "Striped top"

### AC9: A field over the limit is refused before asking
Given kit has typed 501 characters into Jo Brown's From Wardrobe
When kit chooses "Copy to Ensemble"
Then the field says it's too long, as Save does, and no dialog opens

### AC10: Nothing is copied when the row itself can't be saved
Given someone else saved Jo Brown as Pirates since kit opened the page
When kit copies Jo's row to Ensemble
Then the form says someone else saved this costume first, as Save does, and no other row is saved

### AC11: A row that couldn't be copied is said, and left as it was
Given someone else saved Sam Patel as Pirates since kit opened the page
When kit copies Jo Brown's row to Ensemble
Then Kim Lee and Chris Evans have the copied costume, Sam's row shows what the other person saved
And the form stays open saying "Couldn't copy to 1 costume. Try again."

## Notes

- FRs: FR16
- Depends on: production-costume-sheets.E1.S3
- Each copy is the existing save of one row (`PUT …/items/{itemId}/costumes`), sent once per row with that row's revision, so the API, its permissions and its checks are unchanged: no new route or store. A row someone else saved since the page loaded answers 409 and is left as they saved it (AC11).
- Copies go one row at a time, so the local file store never sees two writes at once. An ensemble of 40 is a few seconds, with the form busy throughout.
- The buttons extend the shared form actions (Save and Cancel) rather than copying them, and the question goes through the app's one confirmation dialog.
- Only those who can change costumes see a form at all (E1.S2), so read-only viewers never see the copy buttons.
- Help can mention copying when E3.S1 is written; this story adds nothing to Help.
- Out of scope: copying between items, and copying Notes.
