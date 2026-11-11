---
id: confirm-and-loading.E1.S3
title: Files and props confirm in the dialog
epic: E1
status: ready
---

## Story

As a Stage, Tech or Wardrobe volunteer, I want replacing or removing a file, and removing a prop, to ask in iCUE's own dialog, so that I can see which button gets rid of it before anything is lost.

## Acceptance criteria

### AC1: Uploading a file with a name already there asks in the dialog
Given The Big Opening's scenery already has `set-plan.pdf`
When a Stage volunteer adds another file named `set-plan.pdf`
Then the dialog asks "Replace set-plan.pdf? The old copy can't be brought back."
And its buttons are "Replace file" and "Cancel"
And "Cancel" uploads nothing, while "Replace file" replaces it

### AC2: A name taken since the page loaded asks in the dialog
Given someone else added `set-plan.pdf` to The Big Opening's scenery after this page loaded
When this volunteer uploads `set-plan.pdf` and the upload finds the name taken
Then the same dialog asks before replacing it
And "Cancel" uploads nothing and refreshes the list of files, as it does today

### AC3: Removing a file asks in the dialog
Given The Big Opening's scenery has `set-plan.pdf`
When a Stage volunteer chooses "Remove file" on it
Then the dialog asks the question the page asks today, naming `set-plan.pdf`
And its buttons are "Remove file" and "Cancel"
And "Cancel" keeps the file

### AC4: Removing a prop asks in the dialog
Given "Props: Pirate Sketch" has a prop called Treasure chest
When a Props volunteer chooses "Remove prop" on it
Then the dialog asks "Remove the prop Treasure chest from Pirate Sketch?"
And its buttons are "Remove prop" and "Cancel"
And "Cancel" keeps the prop

## Notes

- FRs: FR1, FR2
- Depends on: E1.S1
- The file upload and file list are shared by the Scenery, SFX and Wardrobe pages, so AC1–AC3 hold on all three. Test them once, in the shared components' tests.
- Each question stays word for word. Tests that stubbed the browser's confirm box answer the dialog through E1.S1's shared test helper instead.
