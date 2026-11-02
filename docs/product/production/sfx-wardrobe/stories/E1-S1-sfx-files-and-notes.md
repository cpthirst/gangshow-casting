---
id: production-sfx-wardrobe.E1.S1
title: Keep each item's SFX files and notes on its SFX page
epic: E1
status: done
---

## Story

As someone on the Tech team, I want each item's sound effects and music on its SFX page, so that I can find and share the latest version of a cue in one place.

## Acceptance criteria

### AC1: The SFX page lists the item's files
Given "Opening Number" has "thunder.mp3" (2.4 MB) and "applause.wav" (8.1 MB) in its SFX files
When anyone signed in opens its SFX page
Then "Coming soon" is gone, and the page lists "applause.wav" then "thunder.mp3", each with its type icon, full name and size

### AC2: An item with no SFX files says so
Given "Finale" has no SFX files
When someone with Tech opens its SFX page
Then it says the item has no SFX files yet, and how to add one

### AC3: The page keeps its links and its not-found message
Given the running order is "Opening Number", "Campfire Song", "Finale"
When someone opens the SFX page for "Campfire Song"
Then it links back to the Overview, and to "Opening Number" as Previous and "Finale" as Next
And an item that isn't in the running order shows the not-found message with a link back

### AC4: Tech, Director and admins can upload a file
Given "lee" has Tech
When lee chooses or drags "thunder.mp3" (2.4 MB) onto the SFX page of "Opening Number"
Then the page shows its progress, and then lists "thunder.mp3"
And the upload area has no "no photos" line

### AC5: An upload over 100 MB, or one that fails, says why
Given "lee" has Tech
When lee uploads "overture.wav" (120 MB), or an upload fails part way
Then the page names the file and the reason, and a failed upload can be tried again

### AC6: An upload with a name already there replaces it after a confirm
Given "Opening Number" has "thunder.mp3" in its SFX files
When "lee", who has Tech, uploads another "thunder.mp3" and confirms "Replace thunder.mp3? The old copy can't be brought back."
Then the item has one "thunder.mp3", the new one
And cancelling leaves the old one

### AC7: Choosing a file opens or downloads it
Given "Opening Number" has "cue-sheet.pdf" and "thunder.mp3" in its SFX files
When anyone signed in chooses "cue-sheet.pdf"
Then it opens in a new tab
And choosing "thunder.mp3" downloads it, keeping its name

### AC8: Deleting a file asks to confirm, then deletes it for everyone
Given "lee" has Tech
When lee chooses the trash icon on "thunder.mp3" and confirms "Remove thunder.mp3? This can't be undone."
Then the row goes, and the file is gone from file storage
And cancelling keeps it

### AC9: SFX notes are kept per item
Given "lee" has Tech
When lee writes "Thunder on the second verse" in the SFX notes for "Opening Number"
Then anyone opening that page later sees the note
And no other item's SFX notes, and none of its scenery notes, change

### AC10: Anyone else can view but not change, and the API refuses them
Given "pat" has Stage only
When pat opens the SFX page for "Opening Number"
Then pat sees the files and notes, with no upload area, trash icons or note editing
And the line "You can view the SFX, but not change them: only Tech, Director and admins can."
And the API refuses pat's upload, delete and note change with 403 saying "You can view the SFX, but not change them."

### AC11: Director and admins can change it
Given "dee" has Director, and "ash" is an admin
When either opens the SFX page for "Opening Number"
Then they can upload, delete and change the notes

### AC12: SFX files are kept apart from scenery files
Given "Opening Number" has "set-plan.pdf" in its scenery files and "thunder.mp3" in its SFX files
When anyone opens its SFX page, or its Scenery page
Then the SFX page lists only "thunder.mp3", and the Scenery page only "set-plan.pdf"
And an SFX request for "../scenery/set-plan.pdf" is refused, and "set-plan.pdf" is untouched

### AC13: SFX files and notes go with their item
Given "Cut Sketch" has "boing.mp3" in its SFX files and an SFX note
When the running order is saved without "Cut Sketch"
Then its SFX files and SFX note are deleted, along with its scenery files
And nothing is deleted before the save, so Reset still undoes the removal

### AC14: Scenery is unchanged
Given Scenery's existing tests
When this story is done
Then they pass without changes to what they check

## Notes

- FRs: FR1, FR2, FR3, FR5, FR7, FR8, FR9
- Depends on: none (production-scenery is done)
- Files are kept under `<production>/<item id>/sfx/` in the existing bucket (ADR 0030). The API's access to the bucket widens to `sfx` keys and nothing else. That needs an ADR amending ADR 0030 ([ADR 0032](../../../../adr/0032-sfx-files-beside-scenery-files.md)), and the infra and security reviews. No new AWS resource.
- Scenery's routes, file store, page, upload component and notes are expected to take a department rather than be copied, so the pages stay alike. Scenery's routes and addresses stay as they are.
- The API's refusal is named per route, not by the first permission it names: today Tech's refusal talks about the scenery (production-scenery E1.S1).
- In this story, audio files download with the general file icon. Playing them comes in E1.S3.
- Larger than one ~400-line PR, by agreement (story map, 2026-10-30).
- Out of scope: Wardrobe (E1.S2), the Overview's SFX count and notes, and Usage (E2.S1), Help (E2.S2).
