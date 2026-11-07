---
id: simplify.E3.S3
title: Show how many characters a note has left only near the limit
epic: E3
status: draft
---

## Story

As someone writing item notes on a phone, I want the character limit to appear only when I'm close to it, so that a line I rarely need doesn't sit under every notes box.

## Acceptance criteria

### AC1: No count far from the limit
Given someone is writing Props notes for "Opening Number" with 100 characters in the box
When they look under the box
Then no character count or "Up to 500 characters" line shows

### AC2: A count near the limit
Given someone has typed 460 characters into the notes box
When they look under the box
Then it says "40 characters left"

### AC3: The count is announced
Given someone using a screen reader has typed 460 characters into the notes box
When they move to the box
Then they hear "40 characters left" as its description

### AC4: Too long is still refused
Given someone has pasted 520 characters into the notes box
When they save
Then the note isn't saved and the error message shows, as today

### AC5: Every item page behaves the same
Given the Casting, Props, Scenery, SFX, Mic plot and Wardrobe notes boxes
When each holds 460 characters
Then each says "40 characters left"

## Notes

- FRs: FR11
- Depends on: simplify.E2.S1 (every item page's notes come through the shared frame)
- The maintainer confirmed volunteers rarely approach the 500-character limit (PRD assumptions).
