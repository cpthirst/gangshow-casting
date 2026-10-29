---
id: production-scenery.E2.S7
title: Upload a scenery file
epic: E2
status: draft
---

## Story

As someone on the Stage or Tech team, I want to upload a set plan or design to an item's Scenery page, so that everyone finds the latest copy there instead of in a chat thread.

## Acceptance criteria

### AC1: Stage, Tech, Director and admins can upload a file
Given "pat" has Stage, "lee" has Tech, "dee" has Director and "alex" is an Admin
When each uploads a file to the Scenery page for "Opening Number"
Then each upload is kept, and its row shows in the list with its name and size, in name order

### AC2: The file keeps the name it was uploaded with
Given "pat" has Stage
When pat uploads "Set Plan (Act 1).pdf"
Then its row shows "Set Plan (Act 1).pdf"
And it is in the item's place in file storage under that name

### AC3: The upload area states the images rule
Given "pat" has Stage
When pat opens a Scenery page
Then the upload area says "Scenery and set images only: no photos of cast members."

### AC4: Upload works by keyboard
Given "pat" has Stage and uses only a keyboard
When pat reaches the upload control and chooses a file
Then the file uploads, as it does when dragged onto the upload area

### AC5: A file of 100 MB uploads
Given "pat" has Stage
When pat uploads a file of exactly 100 MB
Then it is kept and shows in the list

### AC6: The page refuses a file over 100 MB
Given "pat" has Stage
When pat chooses "rig.mov", of 120 MB
Then it isn't uploaded
And the page says "rig.mov is over 100 MB, so it wasn't uploaded."

### AC7: Storage refuses a file over 100 MB whatever sends it
Given someone with Stage who skips the page and sends a 120 MB file using the upload the API gave them
When it reaches file storage
Then it is refused, and no file is kept

### AC8: Anyone else can't upload
Given "sam" has Casting only and "jo" has no permissions
When either opens a Scenery page
Then there's no upload area
And the API refuses their request to upload with 403 saying "You can view the scenery, but not change it."

### AC9: An upload only reaches its own item
Given "pat" has Stage
When pat asks to upload a file named "../Finale/plan.pdf" to "Opening Number", or to an item that isn't in the latest saved running order
Then the API refuses it with 400 or 404, and nothing is put in file storage outside "Opening Number"

### AC10: An upload that fails says so
Given "pat" has Stage and the connection drops during the upload of "set-plan.pdf"
When the upload fails
Then the page says "set-plan.pdf wasn't uploaded. Check your connection and try again."
And the list doesn't show it

## Notes

- FRs: FR5, FR8, FR12
- Depends on: production-scenery.E2.S1
- Files go from the browser straight to file storage, never through the API, which caps a request at 10 MB (PRD constraints). The API checks the caller's permission, the item and the name, and hands back a short-lived upload that file storage limits to 100 MB (AC7), as the ADR from E2.S1 decides.
- The upload route names Stage, Tech and Director (E1.S1), and admins are always allowed.
- Any file type is allowed. The page and API never inspect the contents (PRD non-goals).
- A file with the same name as one already on the item: until E2.S5 adds the confirm, the upload is refused with "There's already a file called set-plan.pdf." so nothing is replaced unasked.
- Out of scope: progress and replacing (E2.S5).
