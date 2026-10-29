---
id: production-scenery.E2.S5
title: Show upload progress, and replace a file of the same name
epic: E2
status: draft
---

## Story

As someone on the Stage or Tech team, I want to see an upload's progress and to replace an old version by uploading the new one, so that I know a big file on a backstage connection is getting there, and the page holds only the latest version.

## Acceptance criteria

### AC1: The page shows progress while a file uploads
Given "pat" has Stage
When pat uploads "set-plan.pdf", of 40 MB
Then the page shows how much of it has uploaded, as it goes
And it shows the row once the upload finishes

### AC2: Progress and the result are announced
Given "pat" uses a screen reader
When pat uploads "set-plan.pdf"
Then it announces that the upload has started and when it has finished or failed

### AC3: The rest of the page works during an upload
Given "pat" is uploading a large file
When pat chooses another file's row
Then that file downloads while the upload carries on

### AC4: A file of the same name asks to replace
Given "Opening Number" has "set-plan.pdf"
When "pat" uploads another file called "set-plan.pdf"
Then the page asks "Replace set-plan.pdf?"
And when pat confirms, the new file is kept in its place, and the row shows its size

### AC5: Cancelling a replace keeps the old file
Given "Opening Number" has "set-plan.pdf"
When "pat" uploads another "set-plan.pdf" and cancels the confirm
Then nothing is uploaded, and the old file is unchanged

### AC6: Names are compared exactly
Given "Opening Number" has "set-plan.pdf"
When "pat" uploads "Set-Plan.pdf"
Then it is added as a second file, with no confirm

### AC7: The API won't replace a file unasked
Given "Opening Number" has "set-plan.pdf"
When an upload of "set-plan.pdf" reaches the API without saying it replaces the file
Then it is refused with 409, and the old file is unchanged

### AC8: A failed upload can be tried again
Given "pat"'s upload of "set-plan.pdf" failed
When pat chooses "Try again"
Then the same file uploads again, without choosing it a second time

## Notes

- FRs: FR8, FR9
- Depends on: production-scenery.E2.S7
- One file at a time (PRD FR8, amended 2026-10-29: the maintainer doesn't need several at once).
- Replacing has no history: the old copy is gone (PRD non-goals). The confirm is the only guard, so it names the file.
- AC7 replaces E2.S7's "There's already a file called …" refusal with the confirm.
