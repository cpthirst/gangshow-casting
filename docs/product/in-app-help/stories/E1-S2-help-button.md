---
id: in-app-help.E1.S2
title: Open the Running order's help from a button on the page
epic: E1
status: ready
---

## Story

As a casting team volunteer in the middle of re-ordering the show, I want to open the page's help where I am, so that I can check what a button does without losing my place or my unsaved changes.

## Acceptance criteria

### AC1: A help button at the top right
Given "sam" is signed in as a Casting Team Member
When sam opens the Running order
Then there is a help button at the top right of the page, beside the "Running order" heading, named "Help for Running order"

### AC2: It opens the page's help
Given sam is on the Running order
When sam presses "Help for Running order"
Then a dialog titled "Running order help" opens, showing the same lines and labels as the Running order section of the Welcome page

### AC3: Focus moves into the help
Given sam has pressed "Help for Running order"
When the dialog opens
Then focus is inside the dialog
And pressing Tab doesn't move focus to the page behind it

### AC4: Close button
Given the Running order help is open
When sam presses its "Close" button
Then the dialog closes and focus returns to "Help for Running order"

### AC5: Escape closes it
Given the Running order help is open
When sam presses Escape
Then the dialog closes and focus returns to "Help for Running order"

### AC6: Clicking outside closes it
Given the Running order help is open
When sam clicks or taps outside the dialog
Then the dialog closes

### AC7: Unsaved changes survive
Given sam has moved "Opening Number" down, so the page shows "Unsaved changes"
When sam opens the Running order help and closes it again
Then "Opening Number" is still in its new place and the page still shows "Unsaved changes"

### AC8: Help never asks the server
Given sam is on the Running order
When sam opens the help
Then the app makes no request to fetch it

### AC9: Same for read-only
Given "jo" is a Read-Only Team Member
When jo opens the Running order
Then jo has the same help button, and it opens the same help

### AC10: It fits a phone
Given sam is on a phone 320px wide
When sam opens the Running order help
Then the help fits the screen without scrolling sideways, and the help button sits beside the heading without crowding it

## Notes

- FRs: FR6, FR7, FR8, FR9
- Depends on: in-app-help.E1.S1
- Build the help button and dialog once, so the E2 stories only add each page's text and the button.
- The help text comes from the same place E1.S1's Welcome section uses (FR9); AC2 checks they match.
- AC10 is a layout check. Ask whether to add the open help to the e2e walks (ADR 0011); otherwise cover it in a component test as far as it can go.
- Out of scope: help on other pages (E2).
