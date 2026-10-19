---
id: casting-overview-by-item.E2.S4
title: Show each cast member's items on their casting sheet
epic: E2
status: ready
---

## Story

As a cast member handed my casting sheet, I want a list of the show's items with a tick where I'm in it and space to note costume from home, so that I know which items I'm in and what to bring.

## Acceptance criteria

### AC1: Each page has a three-column table
Given the casting sheets document
When I open any page
Then under the heading is a table with a header row "Item Name", "Am I cast", "Costume from home"

### AC2: Every printed item is a row, in show order, with its number
Given a running order with printed items 1 "Opening", 2 "Campfire Song" and 3 "Finale"
When I open a page
Then the rows read "1 Opening", "2 Campfire Song", "3 Finale" in that order

### AC3: Unprinted items are left out
Given "Scene Change Music" is not in the printed programme
When I open a page
Then there is no "Scene Change Music" row, even on the page of someone cast in it

### AC4: The halves are separated
Given "Opening" is in the first half "Act One" and "Finale" in the second half "Act Two"
When I open a page
Then a row naming "Act Two" separates the last first-half item from "Finale"

### AC5: A tick shows where the person is cast
Given Ava Example has a lead in "Opening" and is in the ensemble of "Finale"
When I open Ava's page
Then "Am I cast" shows a tick for "Opening" and "Finale" and is empty for "Campfire Song"

### AC6: Someone with no parts has no ticks
Given Cara Test has no roles
When I open Cara's page
Then every "Am I cast" cell is empty

### AC7: Costume from home is blank with room to write
Given any page
When I print it
Then every "Costume from home" cell is empty and tall enough to write in by hand

### AC8: Each sheet fits a page
Given a show of 30 printed items
When I print the document
Then each cast member's sheet fits on one A4 page

## Notes

- FRs: FR12, FR13
- Depends on: E2.S3
- No role names on the sheet: only the tick (PRD non-goal).
- AC8 assumes about 30 printed items; a longer show may spill onto a second page, which is acceptable.
- Out of scope: show dates or venue (PRD open question; not stored).
