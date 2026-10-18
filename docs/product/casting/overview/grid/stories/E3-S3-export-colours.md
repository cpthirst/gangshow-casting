---
id: casting-overview-grid.E3.S3
title: Colour the exported cells like the grid
epic: E3
status: done
---

## Story

As an admin, I want the exported cells coloured like the on-screen grid, so that the printed or shared sheet reads the same at a glance.

## Acceptance criteria

### AC1: Lead cells match the lead colour
Given Sam is a lead in "Pirate Sketch"
When I export the grid
Then Sam's "Pirate Sketch" cell is filled in the same colour as the lead dot

### AC2: Support, cameo and ensemble cells match too
Given Alex is a support, Sam is a cameo and Jo is in an ensemble
When I export the grid
Then each cell is filled in its size's colour, the same as in the grid

### AC3: Empty cells have no fill
Given Sam is not in "Opening Number"
When I export the grid
Then Sam's "Opening Number" cell has no fill

### AC4: The letter is still there
Given a filled cell
When I look at it in Excel
Then it still holds its letter L, S, C or E, so the sheet reads in black and white

### AC5: Text stays readable on the fill
Given any filled cell
When I look at its letter
Then the letter's colour against the fill meets 4.5:1 contrast

### AC6: Unprinted items keep their red italics
Given "Entr'acte" is not in the printed programme
When I export the grid
Then its heading in the file is bold italic in the grid's dark red, and printed headings are not italic

## Notes

- FRs: FR13
- Depends on: casting-overview-grid.E3.S2
- The colours live in `packages/shared` (`gridLetterColours`, `unprintedHeadingColour`) for the server; a web test (`grid-colours.test.ts`) reads `styles.css` and fails if the screen's colours ever differ from them. The request now carries `{ heading, printed }` per item so the file can show unprinted items as the grid does.
- Out of scope: any other formatting or a legend sheet.
