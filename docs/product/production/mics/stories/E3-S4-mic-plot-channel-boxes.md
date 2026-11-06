---
id: production-mics.E3.S4
title: Box each channel in the Mic Plot workbook, roles in italics, unused mics grey
epic: E3
status: done
---

## Story

As the sound desk, I want each channel in the Mic Plot workbook boxed on its own, with its role in italics and unused mics greyed out, so that I can see at a glance which mics are live in each item.

## Acceptance criteria

### AC1: One box per channel
Given "Space Sketch" has Mic 1 for Alex Morgan as "Alien 1"
When the workbook is opened
Then "Mic 1", "Alex Morgan" and "Alien 1" sit inside one thin border
And there are no lines between them

### AC2: Roles in italics
Given "Space Sketch" has Mic 1 for Alex Morgan as "Alien 1"
When the workbook is opened
Then "Alien 1" is in italics, and "Alex Morgan" is not

### AC3: Unused mics in grey
Given "Space Sketch" has Mic 1 for Alex Morgan and nobody on Mic 2
When the workbook is opened
Then "Mic 2" is in mid grey
And "Mic 1" and "Alex Morgan" are in black

## Notes

- FRs: FR14. Asked for by the maintainer after production-mics.E3.S2, which this refines; nothing else about the workbook changes.
- A channel with a cast member but no role is in use, so it stays black.
- The empty cells that pad the last row (after Mic 24) are boxed the same way, so every row of a block lines up.
