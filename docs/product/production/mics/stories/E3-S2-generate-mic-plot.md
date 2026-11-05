---
id: production-mics.E3.S2
title: Generate the Mic Plot workbook from the Overview
epic: E3
status: done
---

## Story

As the sound desk, I want to download the whole show's mic plot as an Excel workbook laid out like the one we already use, so that I can print it for the show without retyping anything.

## Acceptance criteria

### AC1: Generate Mic Plot downloads a workbook
Given a saved running order with mics given out
When anyone signed in chooses Generate Mic Plot, beside Generate Props List on the Overview
Then an Excel workbook downloads

### AC2: Title and halves
Given the 2027 production, with items in Act 1 and Act 2
When the workbook is opened
Then its first row reads "CHESTER GANG SHOW 2027 - MIC PLOT"
And the items appear under "ACT 1" and "ACT 2" headings, in running order

### AC3: One block per item, channels in rows of nine
Given "Space Sketch" has Mic 1 for Alex Morgan as "Alien 1" and Mic 20 for Jo Reed with no role
When the workbook is opened
Then "Space Sketch" is in the first column beside its whole block
And the block has header rows "Mic 1"–"Mic 9", "Mic 10"–"Mic 18" and "Mic 19"–"Mic 24"
And under "Mic 1" is "Alex Morgan" then "Alien 1", under "Mic 20" is "Jo Reed" then a blank, and every unused channel is blank

### AC4: Notes beside the block
Given "Space Sketch" has Mic plot notes "Mics 19–24 on for songs only"
When the workbook is opened
Then the note is beside the block under a "Notes" heading
And an item without notes has the space left empty

### AC5: Each item shaded in its own colour, repeating per half
Given Act 1 and Act 2 each have three items
When the workbook is opened
Then neighbouring items' blocks are shaded in different colours
And the first item of Act 2 has the same colour as the first item of Act 1, the second the same as the second, and so on

### AC6: Formatted for printing
When the workbook is opened
Then headers are bold, cells are centred with thin borders, and it is set to print on A4 portrait

### AC7: Names stay text
Given a cast member whose first name is "=SUM(A1)"
When the workbook is opened
Then the cell shows "=SUM(A1) …" as text, not a formula

### AC8: Each use is recorded on the Usage page
Given "lee" chooses Generate Mic Plot
When an admin opens the Usage page
Then "Generate Mic Plot" shows 1 use by 1 person, as Generate Props List does

### AC9: No running order
Given no saved running order
When someone opens the Overview
Then Generate Mic Plot isn't offered, as Generate Props List isn't

## Notes

- FRs: FR14, FR16 (Generate Mic Plot)
- Depends on: production-mics.E1.S3 (E1.S2 for roles, E2.S2 so kept allocations print as they show)
- May need a spreadsheet library. Choosing it belongs to this story, with an ADR if it's a runtime dependency, and the security review for the new dependency.
- The 2026 Mic Plot is the layout reference only. It holds real names and is never committed; tests use made-up names (PRD security).
- Out of scope: Help text about the workbook (E3.S3).
- Decision: [ADR 0033](../../../../adr/0033-mic-plot-workbook-built-in-the-browser.md): built in the browser with `write-excel-file`, loaded only when used, as the Word exports are.
- AC8: at the maintainer's choice (2026-11-05), the Usage page names the feature "Generate Mic Plot", after its button, and the activity reads "generated the Mic Plot".
- Follow-up: [casting-overview-grid.E3.S5](../../../casting/overview/grid/stories/E3-S5-grid-export-in-the-browser.md) moves the casting grid's Excel export to the browser too, at the maintainer's request.
