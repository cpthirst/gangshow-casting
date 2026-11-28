---
id: stores.E3.S3
title: Mark a stores item as destroyed
epic: E3
status: ready
---

## Story

As a Scenery, Props or Wardrobe manager, I want to mark an item as destroyed, with when and why, without deleting its photo, so that the store shows what's really there while we keep a record in case it's ever rebuilt.

## Acceptance criteria

In each AC, the Props store has barrel.jpg, crown.jpg and throne.jpg ("Painted wood, heavy"), and someone with Stage is on its page, unless the AC says otherwise.

### AC1: Someone who can change the store sees Destroy
Then each image that isn't destroyed has a Destroy button, with its icon, on its thumbnail and in the viewer, named for the image ("Destroy throne.jpg")

### AC2: Nobody else sees it, and the API refuses them
Given someone with only Director is on the Props stores page
Then no image has a Destroy button
And a destroy request from them is refused with the Stage department's refusal

### AC3: Destroy asks when and why
When they choose Destroy on throne.jpg
Then a labelled dialog opens with **Date destroyed**, set to today, and **Reason**

### AC4: Saving marks it destroyed and keeps the photo
Given the dialog from AC3
When they enter "Leg snapped at the 2026 get-out" and save
Then throne.jpg shows greyed out in the grid, and it can still be opened, viewed and downloaded

### AC5: A reason is needed
Given the dialog from AC3
When they save without a reason
Then the dialog stays open and says a reason is needed

### AC6: The reason has the description's limit
Given the dialog from AC3
When the reason passes 300 characters
Then it can't be saved, and the count shows only near the limit, as for a description

### AC7: Cancelling changes nothing
Given the dialog from AC3
When they cancel
Then throne.jpg isn't destroyed, and focus returns to its Destroy button

### AC8: Destroyed images sit at the bottom of the grid
Given throne.jpg and barrel.jpg are destroyed
Then the grid shows crown.jpg, then barrel.jpg and throne.jpg, greyed out and in name order, after it

### AC9: The viewer's info button says why
Given throne.jpg was destroyed on 3 November 2026 by `stage-manager`, for "Leg snapped at the 2026 get-out"
When anyone signed in opens it in the viewer
Then it has an info button beside download, which shows "Destroyed 3 November 2026", the reason, and "Recorded by stage-manager"

### AC10: An image in store has no info button
When anyone opens crown.jpg in the viewer
Then there's no info button

### AC11: Restore undoes it
Given throne.jpg is destroyed
When someone with Stage chooses Restore in its info and confirms
Then throne.jpg is back in name order with the others, no longer greyed, and its date and reason are gone

### AC12: Only those who can change the store can restore
Given throne.jpg is destroyed
When someone with only Director opens its info
Then it has no Restore button, and a restore request from them is refused

### AC13: The overview counts only what's in store
Given throne.jpg is destroyed
When anyone opens the Stores overview
Then it shows Props with "2 images"

### AC14: A destroyed image can still be deleted
Given throne.jpg is destroyed
When someone with Stage deletes it with the trash icon and confirms
Then it's gone from the store, with its date and reason

### AC15: An image deleted elsewhere says so
Given throne.jpg was deleted in another browser since the page loaded
When they destroy it
Then the page says it's no longer in the store, and the grid catches up

## Notes

- FRs: FR29, FR30, FR31, FR32
- Depends on: stores.E3.S1 (the dialog and the 300-character count follow the description's), stores.E2.S3 (AC13)
- Destroying keeps the image in file storage. Its date, reason and who recorded it (the account's username, ADR 0018) are stored beside its description, so the ADR from E1.S1 is amended to say so. No new AWS resource.
- Safeguarding: a reason is about the item. Help (E5.S1) says not to name cast members in it, as for descriptions. It's shown as text, never as HTML.
- The icon comes from the app's shared Font Awesome set (`utils/icons.ts`). Pick one that reads as "no longer usable", such as `faBan`, distinct from the trash icon.
- The grid and viewer are shared with the production gallery. The greyed look, the bottom-of-grid order and the info button are options of the shared pieces, off on the production pages, and tested once in the shared pieces' own tests.
- A destroyed image keeps its pencil: its name and description can still be edited.
- Decided by Nick Hirst, 2026-11-28: date and reason, undoable with Restore.
- Out of scope: a history of destroys and restores; destroying several at once.
