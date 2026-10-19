---
id: casting-overview-by-item.E2.S4
title: Show each cast member's items on their casting sheet
epic: E2
status: done
---

## Story

As a cast member handed my casting sheet, I want a list of the show's items with a tick where I'm in it and space to note costume from home, so that I know which items I'm in and what to bring.

## Acceptance criteria

### AC1: Each page has a four-column table
Given the casting sheets document
When I open any page
Then under the heading is a table with a header row "#", "Item Name", "Cast", "Costume from home"
And the columns take 7%, 40%, 10% and 43% of the width

### AC2: Every item is a row, in show order, with its number
Given a running order whose first half has printed items 1 "Opening" and 2 "Campfire Song", and whose second half has 1 "Finale" (numbers restart each half, as in the running order)
When I open a page
Then the item rows read 1 "Opening", 2 "Campfire Song", 1 "Finale" in that order, each number in the # column

### AC3: Unprinted items are marked
Given "Scene Change Music" is not in the printed programme
When I open a page
Then "Scene Change Music" has a row in its place in show order, with no number, its name in the grid's red italics
And it is ticked for someone cast in it, like any other item

### AC4: The halves are separated
Given "Opening" is in the first half "Act One" and "Finale" in the second half "Act Two"
When I open a page
Then a row naming "Act Two" separates the last first-half item from "Finale"

### AC5: A tick shows where the person is cast
Given Ava Example has a lead in "Opening" and is in the ensemble of "Finale"
When I open Ava's page
Then "Cast" shows a tick for "Opening" and "Finale" and is empty for "Campfire Song"

### AC6: Someone with no parts has no ticks
Given Cara Test has no roles
When I open Cara's page
Then every "Cast" cell is empty

### AC7: Costume from home is blank with room to write
Given any page
When I print it
Then every "Costume from home" cell is empty, and every item row is two lines of text tall, room to write in by hand

### AC8: A long show carries on over the page
Given a show of 30 items
When I print the document
Then each cast member's sheet is on A4, and where their table runs onto a second page its header row is repeated there

## Notes

- FRs: FR12, FR13
- Depends on: E2.S3
- No role names on the sheet: only the tick (PRD non-goal).
- Changed on 2026-10-19 at the maintainer's request: a "#" column for the number, widths 7/40/10/43%, "Am I cast" renamed "Cast", rows two lines tall, and items not in the printed programme included in red italics (AC3 used to leave them out). At that height about 22 items fit on a sheet's first page, so AC8 no longer asks for one page.
- Out of scope: show dates or venue (PRD open question; not stored).
