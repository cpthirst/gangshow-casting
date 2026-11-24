---
id: production-costume-sheets.E2.S3
title: Cross-hatch the blank cells on the costume sheets
epic: E2
status: done
---

## Story

As someone on the Wardrobe team, I want the blank cells on each costume sheet cross-hatched, so that the cast can see a cell was left blank on purpose and don't think something was missed.

## Acceptance criteria

### AC1: An item the cast member isn't in is hatched across its costume cells
Given Alex Morgan isn't in "Pirate Dance"
When the costume sheets are generated
Then Alex's "Pirate Dance" row has its "Role", "From Wardrobe" and "From Cast Member" cells cross-hatched in a thin pale-grey diagonal cross on white
And its "#" and "Item Name" cells are not hatched

### AC2: An empty costume field in an item they are in is hatched
Given Alex Morgan is "Captain Hook" in "Opening Number" with From Wardrobe "Red coat, hook" and From Cast Member left empty
When the costume sheets are generated
Then Alex's "Opening Number" row has its "From Cast Member" cell cross-hatched
And its "Role" and "From Wardrobe" cells are not hatched

### AC3: Filled cells are not hatched
Given Jo Brown is "Smee" in "Opening Number" with From Wardrobe "Striped shirt" and From Cast Member "Red hat"
When the costume sheets are generated
Then none of Jo's "Opening Number" cells are hatched

### AC4: An unprinted item's blank number is not hatched
Given "Bonus Sketch" is left out of the printed programme, and Alex Morgan isn't in it
When the costume sheets are generated
Then Alex's "Bonus Sketch" row has an empty "#" cell that is not hatched, and its "Role", "From Wardrobe" and "From Cast Member" cells are hatched

### AC5: The casting sheets are unchanged
Given Alex Morgan isn't in "Pirate Dance"
When the casting sheets are generated
Then Alex's "Pirate Dance" row's empty "Cast" cell is not hatched

## Notes

- FRs: FR15
- Depends on: production-costume-sheets.E2.S2
- The hatching is Word's own cell shading, a thin diagonal cross pattern (pale grey on white), from the `docx` library already in use: no new dependency. It prints in black and white. Word shows it; Google Docs and some other apps may show a plain fill or nothing, which the Wardrobe lead knows.
- The costume and casting sheets share one document (ADR 0022). Hatching is a choice of the costume sheets' kind, through the shared cell, not a copy of the table.
- Help doesn't describe the hatching: it explains itself (CLAUDE.md, "Simplicity").
- Out of scope: hatching on the casting sheets, the props list or the mic plot.
