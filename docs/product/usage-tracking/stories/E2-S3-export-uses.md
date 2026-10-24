---
id: usage-tracking.E2.S3
title: Record each export, and count it per person
epic: E2
status: done
---

## Story

As an admin, I want to see who exports the casting to Excel and Word and how often, so that I know which printouts the team depends on.

## Acceptance criteria

### AC1: An Excel export is recorded
Given "robin" is on the Casting Overview's Grid
When "robin" exports to Excel and the file is made
Then a use "Export: Excel grid" is recorded for "robin"

### AC2: Each Word export is recorded by name
Given "robin" is on the Casting Overview
When "robin" exports to Word from By person, and then from By item
Then the uses "Export: Word casting sheets" and "Export: Word item overview" are recorded

### AC3: A failed export isn't recorded
Given an export fails and the page says so
When "robin" exports to Excel
Then no export use is recorded

### AC4: The summary counts exports per person
Given in the last 30 days "alex" exported to Excel twice and the Word casting sheets once
When an admin opens the Usage page
Then "alex"'s row shows Export: Excel grid 2 and Export: Word casting sheets 1

### AC5: A failed recording doesn't get in the way
Given recording a use fails
When "robin" exports to Word
Then the file is still made, and the page says only that the export is done

## Notes

- FRs: FR2 (exports), FR3, FR5
- Depends on: usage-tracking.E2.S1
- Today's exports are all on the Casting Overview: Excel from Grid, Word casting sheets from By person, and Word item overview from By item. Any export added later should be recorded too.
- Out of scope: recording what was in the export.
