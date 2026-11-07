---
id: simplify.E4.S1
title: Load the file department pages' data one shared way
epic: E4
status: ready
---

## Story

As the maintainer, I want one shared way to load data from the API, with one rule for failures and one for "nothing there yet", so that each page asks for its data in one line, and every page treats a failure the same way.

## Acceptance criteria

### AC1: A file department page loads as today
Given "Opening Number" has two scenery files and scenery notes
When someone opens its Scenery page
Then the files and notes show as they do today

### AC2: Nothing there yet shows as empty, not as a failure
Given "Opening Number" has no SFX files and no SFX notes yet
When someone opens its SFX page
Then the page shows no files and an empty notes box, with no error

### AC3: A failure shows the page's error
Given the API fails when the Wardrobe page asks for the item's files
When someone opens the Wardrobe page for "Opening Number"
Then the page shows its usual error message, as it does today

### AC4: A refusal is not a failure to load
Given the API refuses a request because the person's sign-in has expired
When the Scenery page loads
Then the page does what it does today for an expired sign-in

## Notes

- FRs: FR17
- Depends on: none
- Goes just before simplify.E2.S1, so each item page moves onto the shared frame and the shared loading together, and is only reworked once (PRD constraints).
- Out of scope: the other item pages (in each E2 story) and the list pages (E4.S2).
