---
id: production-scenery.E2.S8
title: Drag a file onto the upload area to upload it
epic: E2
status: draft
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

## Notes

- FRs: FR8
- Depends on: production-scenery.E2.S7
- Split from E2.S7 at `write-story` (2026-10-29) to keep it to one PR. A dropped file goes through the same checks and upload as a chosen one.
