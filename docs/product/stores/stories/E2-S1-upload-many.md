---
id: stores.E2.S1
title: Upload many images at once
epic: E2
status: done
---

## Story

As a Scenery, Props or Wardrobe manager photographing a store, I want to choose or drop a whole batch of photos at once and leave them to upload, so that recording a store takes minutes, not an evening of one-at-a-time uploads.

## Acceptance criteria

In each AC, the Wardrobe store is empty, and someone with Wardrobe is on its page.

### AC1: Choosing many uploads them all
When they choose cloak.jpg, crown.jpg and tunic.jpg at once
Then all three upload and show in the grid in name order

### AC2: Dropping many uploads them all
When they drop cloak.jpg, crown.jpg and tunic.jpg on the upload area
Then all three upload

### AC3: One still works
When they choose cloak.jpg alone
Then it uploads, as before

### AC4: A batch asks nothing
When they choose cloak.jpg, crown.jpg and tunic.jpg
Then no dialog or field asks for a name, a description or anything else before every file has gone

### AC5: Progress shows the batch
Given cloak.jpg has gone, and crown.jpg and tunic.jpg are uploading
Then the upload shows "Uploading 2 of 3" and how much of the whole batch has gone

### AC6: Each image joins the grid as it finishes
Given cloak.jpg has finished and crown.jpg hasn't
Then cloak.jpg's thumbnail is in the grid

### AC7: A few go at a time
When they choose 50 photos
Then no more than a few upload at once, and all 50 finish

### AC8: Screen readers hear only the start and end
When they choose cloak.jpg, crown.jpg and tunic.jpg
Then the page announces "Uploading 3 files" at the start and "3 files uploaded" at the end, and nothing for each file between

### AC9: A drop during a batch waits
Given a batch is uploading
When they drop crown.jpg
Then it isn't uploaded, and the page says "Wait for the upload to finish."

### AC10: The production file pages take many too
Given someone with Stage is on "Opening Number"'s Scenery page
When they choose set-plan.jpg and build-list.pdf at once
Then both upload, and set-plan.jpg shows under Images and build-list.pdf under Other Files

## Notes

- FRs: FR9, FR10, FR13
- Depends on: stores.E1.S2
- One upload for all: `FileUpload.vue` learns to take many, so the stores and the production Scenery, SFX and Wardrobe pages all get it at once (FR13, CLAUDE.md "Extend the shared piece"). Its own tests cover one and many; each page keeps one check that it's wired up (AC10).
- "A few at a time" (AC7): about three, chosen in code; the test checks the cap, not the number.
- What happens to a file that's refused, has a name already used, or fails is E2.S2. Here, a batch with any such file uploads the rest; the single-file messages and replace question from E1.S2 still apply to a batch of one.
- Run `pnpm test:e2e`: the upload area changes on every file page.
- Out of scope: the end-of-batch list (E2.S2).
