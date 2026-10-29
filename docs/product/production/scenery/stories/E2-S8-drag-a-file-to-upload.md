---
id: production-scenery.E2.S8
title: Drag a file onto the upload area to upload it
epic: E2
status: done
---

## Story

As someone on the Stage or Tech team, I want to drag a set plan from my computer onto the Scenery page, so that I can upload it without hunting for it in a file picker.

## Acceptance criteria

### AC1: A dragged file uploads
Given "pat" has Stage
When pat drags "set-plan.pdf" onto the upload area for "Opening Number"
Then it uploads as a chosen file does, and its row shows in the list

### AC2: The upload area shows where to drop
Given "pat" has Stage
When pat drags a file over the upload area
Then the area is highlighted until pat drops it or drags it away

### AC3: Only one file at a time
Given "pat" has Stage
When pat drags two files onto the upload area at once
Then neither is uploaded
And the page says "Drop one file at a time."

### AC4: The upload area says a file can be dropped
Given "pat" has Stage
When pat opens the Scenery page for "Opening Number"
Then the upload area says "or drag one here" beside "Add a file", on a computer, where a file can be dragged in
And someone without Stage, Tech, Director or admin doesn't see it

### AC5: A file dropped during an upload waits
Given "pat" is uploading "set-plan.pdf"
When pat drops "backdrop.png" onto the upload area
Then "backdrop.png" isn't uploaded
And the page says "Wait for the upload to finish."

## Notes

- FRs: FR8
- Depends on: production-scenery.E2.S7
- Split from E2.S7 at `write-story` (2026-10-29) to keep it to one PR. A dropped file goes through the same checks and upload as a chosen one.
- AC4 and AC5 added at `write-story` (2026-10-29): without a hint nobody would know dropping works, and a drop during an upload says why it was ignored.
- At review (2026-10-29), with the user's agreement: the hint is hidden on phones and tablets (no hover), the area isn't highlighted during an upload, and only a drag of files is highlighted or taken. The hint's hiding is CSS alone, so no unit test can see it.
