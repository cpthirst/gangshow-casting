---
id: production-scenery.E2.S5
title: Show upload progress, and replace a file of the same name
epic: E2
status: done
---

## Story

As someone on the Stage or Tech team, I want to see an upload's progress and to replace an old version by uploading the new one, so that I know a big file on a backstage connection is getting there, and the page holds only the latest version.

## Acceptance criteria

### AC1: The page shows progress while a file uploads
Given "pat" has Stage
When pat uploads "set-plan.pdf", of 40 MB, and 12 MB of it has gone
Then the upload area shows "Uploading set-plan.pdf: 12 MB of 40 MB" and a progress bar 30% full
And it shows the row once the upload finishes, and the progress goes

### AC2: The start and end of an upload are announced
Given "pat" uses a screen reader
When pat uploads "set-plan.pdf"
Then it announces "Uploading set-plan.pdf" as it starts, and "set-plan.pdf uploaded" when it finishes
And a failed upload's message is announced as an alert, as it is now

### AC3: The rest of the page works during an upload
Given "pat" is uploading a large file
When pat chooses another file's row
Then that file downloads while the upload carries on

### AC4: A file of the same name asks to replace
Given "Opening Number" has "set-plan.pdf"
When "pat" uploads another file called "set-plan.pdf"
Then the page asks "Replace set-plan.pdf? The old copy can't be brought back."
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

### AC8: A file added elsewhere since the page loaded also asks to replace
Given pat's page loaded before "lee" added "set-plan.pdf" to "Opening Number" in another browser
When pat uploads "set-plan.pdf"
Then the page lists lee's file and asks "Replace set-plan.pdf? The old copy can't be brought back."
And when pat confirms, pat's file is kept in its place

### AC9: A failed upload can be tried again
Given "pat"'s upload of "set-plan.pdf" failed
When pat chooses "Try again"
Then the same file uploads again, without choosing it a second time

## Notes

- FRs: FR8, FR9
- Depends on: production-scenery.E2.S7
- Refined 2026-10-29: the progress wording and bar, the confirm's warning, asking to replace on a 409 (AC8), and announcing only the start and end were agreed with the maintainer.
- One file at a time (PRD FR8, amended 2026-10-29: the maintainer doesn't need several at once). The upload button stays disabled while one runs.
- Replacing has no history: the old copy is gone (PRD non-goals). The confirm is the only guard, so it names the file and says so, as the delete confirm does.
- AC4 and AC8 replace E2.S7's "There's already a file called …" refusal with the confirm. The API already returns 409 unless the request says `replace` (E2.S7), so AC7 needs no API change.
- Progress needs `XMLHttpRequest`'s upload events: `fetch` can't report how much of a body has gone. The progress bar is a native `<progress>`, and only the start and end are announced, so a screen reader isn't flooded.
- Trying again asks the API for a fresh upload, since the last one's lasts only 5 minutes, and keeps whether it replaces.
- The local folder store (`pnpm dev`, the demo) on a Mac or Windows disk ignores case, so there "Set-Plan.pdf" lands on "set-plan.pdf". File storage (S3) compares exactly, as AC6 needs; the local quirk is left as it is.
- Out of scope: dragging a file onto the upload area (E2.S8).
