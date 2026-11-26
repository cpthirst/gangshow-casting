---
id: stores.E2.S2
title: List the files a batch didn't upload
epic: E2
status: draft
---

## Story

As a manager who has left a batch of photos uploading, I want one list at the end saying which didn't go and why, with one step to sort each kind out, so that I don't have to watch the upload or find the missing ones myself.

## Acceptance criteria

In each AC, the Wardrobe store has crown.jpg, and someone with Wardrobe is on its page.

### AC1: Refused files are listed and the rest upload
When they choose cloak.jpg, notes.pdf and a 120 MB gown.jpg at once
Then cloak.jpg uploads, and when the batch ends the page lists notes.pdf as not an image the store keeps and gown.jpg as over 100 MB

### AC2: A name already used is kept back, not replaced
When they choose cloak.jpg and crown.jpg at once
Then cloak.jpg uploads, the stored crown.jpg is unchanged, and the page lists crown.jpg as a name the store already has

### AC3: Kept-back files can be replaced in one step
Given the list from AC2
When they choose "Replace them"
Then the page asks once whether to replace the 1 file, and confirming replaces crown.jpg

### AC4: Failed files can be tried again in one step
Given cloak.jpg and tunic.jpg failed to upload because the connection dropped
When they choose "Try again"
Then both upload again, and the list goes once they have

### AC5: A batch with nothing wrong shows no list
When they choose cloak.jpg and tunic.jpg and both upload
Then no list shows

### AC6: The list is announced once
When a batch ends with files listed
Then screen readers hear the list once, not each file as it fails

### AC7: The next batch clears the list
Given the list from AC1 shows
When they start another batch
Then the list goes

### AC8: The production file pages show the same list
Given someone with Stage is on "Opening Number"'s Scenery page, which has set-plan.jpg
When they choose set-plan.jpg and backdrop.png at once
Then backdrop.png uploads and the page lists set-plan.jpg as a name the item already has

## Notes

- FRs: FR11, FR13
- Depends on: stores.E2.S1
- The list belongs to the shared upload, so its tests live there; AC8 checks a production page is wired to it.
- **Open question**: when a *single* file's name is already used, does it keep today's "Replace …? The old copy can't be brought back." confirm (E1.S2 AC12), or go into this list like a batch's? Owner: Nick Hirst. Ready once answered.
- A name used by the batch twice (two crown.jpg from different folders) keeps the first and lists the second.
- Out of scope: renaming a kept-back file before uploading it.
