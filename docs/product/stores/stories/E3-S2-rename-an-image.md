---
id: stores.E3.S2
title: Rename a stores image
epic: E3
status: ready
---

## Story

As a Scenery, Props or Wardrobe manager, I want to give a photo a proper name, not "IMG_4021.jpg", so that the store and the catalogue say what each item is at a glance.

## Acceptance criteria

In each AC, the Props store has IMG_4021.jpg, described "Wooden, painted gold", and treasure-chest.jpg, and someone with Stage is on its page.

### AC1: The pencil's dialog has the name
When they choose IMG_4021.jpg's pencil
Then the dialog has a Name field holding "IMG_4021" and the extension ".jpg" beside it, above the Description

### AC2: Saving a new name renames the image
Given the dialog for IMG_4021.jpg is open
When they change the name to "wooden-sword" and save
Then the image is wooden-sword.jpg for everyone, its thumbnail moves to its place in name order, and it still opens and downloads

### AC3: The description goes with it
Given IMG_4021.jpg was renamed wooden-sword.jpg
When anyone opens wooden-sword.jpg in the viewer
Then it shows "Wooden, painted gold"

### AC4: The extension stays
Given the dialog for IMG_4021.jpg is open
When they change the name to "wooden-sword.png" and save
Then the image is wooden-sword.png.jpg, still a JPG

### AC5: A name already in the store is refused
Given the dialog for IMG_4021.jpg is open
When they change the name to "treasure-chest" and save
Then the page says "treasure-chest.jpg is already in the store." and the dialog stays open with nothing changed

### AC6: An empty name is refused
Given the dialog for IMG_4021.jpg is open
When they clear the name and save
Then the dialog says the name is needed and stays open

### AC7: Changing only the description keeps the name
Given the dialog for IMG_4021.jpg is open
When they change only the description and save
Then the image is still IMG_4021.jpg

### AC8: The API refuses anyone else
When someone with only Wardrobe asks the API to rename IMG_4021.jpg in the Props store
Then it answers 403 with the Props department's refusal, "You can view the props, but not change them."

### AC9: The API refuses an unsafe name
When someone with Stage asks the API to rename IMG_4021.jpg to "../other/x.jpg"
Then it answers 400 and nothing changes

### AC10: An image changed elsewhere says so
Given someone renamed IMG_4021.jpg in another browser since the page loaded
When someone with Stage renames it here
Then the page says "IMG_4021.jpg isn't there any more." and catches up with the store

## Notes

- FRs: FR15, FR16, FR18
- Depends on: stores.E3.S1
- Renaming is new: item files can't be renamed today. It applies to stores only.
- Names follow the same rules as an uploaded file's name (no folders, the characters storage accepts), checked by one shared rule in `packages/shared`.
- Name and description save together in one request, so a refused name changes neither.
- AC5's wording is a refusal, so it's pinned.
- Out of scope: renaming item files on production pages.
