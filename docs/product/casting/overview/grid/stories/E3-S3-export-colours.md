---
id: casting-overview-grid.E3.S3
title: Colour the exported cells like the grid
epic: E3
status: ready
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

## Notes

- FRs: FR13
- Depends on: casting-overview-grid.E3.S2
- Take colours from the same place the grid gets them so the two cannot drift apart.
- Out of scope: any other formatting or a legend sheet.
