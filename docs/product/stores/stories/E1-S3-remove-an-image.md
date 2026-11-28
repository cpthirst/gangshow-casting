---
id: stores.E1.S3
title: Remove an image from a store
epic: E1
status: done
---

## Story

As a Scenery, Props or Wardrobe manager, I want to remove a photo of something we no longer keep, so that the store shows only what's really there.

## Acceptance criteria

In each AC, the Scenery store has castle-backdrop.png and throne.jpg.

### AC1: The store's department sees a trash icon on each thumbnail
Given someone with Stage opens the Scenery stores page
Then each thumbnail has a trash icon, whose accessible name is "Remove throne.jpg" on throne.jpg's

### AC2: Nobody else sees it
Given someone with only Wardrobe, or only Director, opens the Scenery stores page
Then no thumbnail has a trash icon

### AC3: Removing asks first, and cancelling keeps the image
Given someone with Stage chooses throne.jpg's trash icon
When they choose "Cancel" in the confirmation that asks "Remove throne.jpg? This can't be undone."
Then throne.jpg's thumbnail is still there and nothing is deleted

### AC4: Confirming removes the image
Given the confirmation from AC3 is open
When they choose "Remove file"
Then throne.jpg is deleted, its thumbnail goes, and castle-backdrop.png's stays

### AC5: Removing the last image shows the empty store
Given the Scenery store has only throne.jpg
When someone with Stage removes it
Then the page says the Scenery store has no images yet

### AC6: The API refuses anyone else
Given someone with only Director
When they ask the API to remove throne.jpg from the Scenery store
Then it answers 403 with the Scenery department's refusal, and throne.jpg stays

### AC7: An image already removed elsewhere says so
Given someone removed throne.jpg in another browser since the page loaded
When someone with Stage removes it here
Then the page says "throne.jpg isn't there any more." and catches up with the store

## Notes

- FRs: FR4, FR19
- Depends on: stores.E1.S2
- The trash icon, its confirm and its "isn't there any more" are the gallery's (`RemoveFileButton.vue`, production-image-gallery.E1.S2), so AC1, AC3, AC4 and AC7 check the wiring. Who sees it reads the shared list of stores (E1.S2).
- Removing an image removes its description too, once descriptions exist (E3.S1 checks that).
- Out of scope: descriptions (E3).
