---
id: production-costume-sheets.E2.S1
title: Drop "Costume from home" from the casting sheets
epic: E2
status: done
---

## Story

As someone on the Casting team, I want the casting sheets without the blank "Costume from home" column, so that the sheet says only who is in what and the costume sheets carry the costumes.

## Acceptance criteria

### AC1: The table has three columns
Given a production with a saved running order and a cast
When anyone exports the casting sheets from the Casting Overview's By person view
Then each page's table has the columns "#", "Item Name" and "Cast", in that order, and no "Costume from home" column

### AC2: Item Name takes the dropped column's width
Given the same production
When the casting sheets are exported
Then "#" and "Cast" keep their widths, and "Item Name" is as wide as it and "Costume from home" were together

### AC3: Everything else is unchanged
Given "Opening Number" with Alex Morgan in it, "Pirate Dance" without, and "Bonus Sketch" left out of the printed programme
When the casting sheets are exported
Then Alex Morgan's page is headed as before, lists each item in show order with a break between the halves, shows a tick for "Opening Number" and none for "Pirate Dance", shows "Bonus Sketch" with no number and in the grid's red italics, and each item row is still two lines tall

## Notes

- FRs: FR12
- Depends on: none
- A documentation line too: casting-overview-by-item FR12 and FR13 describe the dropped column; note the change there with the date, as that PRD did on 2026-10-19.
- Out of scope: the costume sheets (E2.S2), Help's description of the columns (E3.S1).
