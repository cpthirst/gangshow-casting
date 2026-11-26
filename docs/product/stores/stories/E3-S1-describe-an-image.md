---
id: stores.E3.S1
title: Describe a stores image
epic: E3
status: ready
---

## Story

As a Scenery, Props or Wardrobe manager, I want to write a few lines about each photo, such as its size, condition or which show it came from, so that the next team knows what the item is without seeing it in person.

## Acceptance criteria

In each AC, the Wardrobe store has cloak.jpg, with no description, and crown.jpg, described "Gold, fits a child's head".

### AC1: The store's department sees a pencil on each thumbnail and in the viewer
Given someone with Wardrobe opens the Wardrobe stores page
Then each thumbnail has a pencil, whose accessible name is "Edit cloak.jpg" on cloak.jpg's, and the viewer has one for the image it shows

### AC2: Nobody else sees it
Given someone with only Stage, or only Director, opens the Wardrobe stores page
Then no thumbnail or viewer has a pencil

### AC3: The pencil opens the image's description
Given someone with Wardrobe
When they choose crown.jpg's pencil
Then a dialog labelled "Edit crown.jpg" opens, with its Description field holding "Gold, fits a child's head" and focus in it

### AC4: Saving keeps the description
Given the dialog for cloak.jpg is open
When they type "Red velvet, long, a few moth holes" and save
Then the dialog closes, focus returns to cloak.jpg's pencil, and the description is kept for everyone

### AC5: Cancelling changes nothing
Given the dialog for crown.jpg is open and its description has been changed
When they cancel or press Escape
Then crown.jpg's description is still "Gold, fits a child's head"

### AC6: The viewer shows the description
Given anyone opens crown.jpg in the viewer
Then it shows "Gold, fits a child's head" under the name crown.jpg

### AC7: Clearing a description removes it
Given the dialog for crown.jpg is open
When they clear the field and save
Then the viewer shows crown.jpg's name and no description

### AC8: A description is at most 300 characters
Given the dialog for cloak.jpg is open
When they type 300 characters
Then the field takes no more, and the count of characters left shows only as they near the limit

### AC9: The API refuses a description over 300 characters
When someone with Wardrobe asks the API to save a 301-character description
Then it answers 400 and the description is unchanged

### AC10: The API refuses anyone else
When someone with only Director asks the API to save a description on crown.jpg
Then it answers 403 with the Wardrobe department's refusal, "You can view the wardrobe, but not change it."

### AC11: An image removed elsewhere says so
Given someone removed cloak.jpg in another browser since the page loaded
When someone with Wardrobe saves a description on it here
Then the page says "cloak.jpg isn't there any more." and catches up with the store

### AC12: Removing an image removes its description
Given crown.jpg is removed, and a new crown.jpg is added
When anyone opens the new crown.jpg in the viewer
Then it has no description

### AC13: A description shows as text
Given a description "<b>bold</b>"
When anyone opens the image in the viewer
Then it shows the characters "<b>bold</b>", not bold text

## Notes

- FRs: FR7, FR15, FR17, FR18
- Depends on: stores.E1.S3
- The description is a new kind of data kept with each stores image, where the E1.S1 ADR says. The shape goes in `packages/shared` first.
- The pencil is the shared `EditButton.vue`; the field's count is the shared characters-left rule used by casting notes (ADR 0014), so AC8 checks the wiring.
- The viewer's description is added to the shared viewer as an optional caption, so the production pages, which have none, are unchanged.
- The dialog has only Description here; E3.S2 adds Name.
- Out of scope: renaming (E3.S2); the catalogue (E4).
