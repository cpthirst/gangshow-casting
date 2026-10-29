---
id: production-scenery.E2.S2
title: Download a scenery file
epic: E2
status: draft
---

## Story

As someone on the production team, I want to download an item's scenery file by choosing its tile, so that I can open the set plan on my phone at rehearsal.

## Acceptance criteria

### AC1: Choosing a tile downloads its file
Given "Opening Number" has "set-plan.pdf"
When someone chooses its tile
Then "set-plan.pdf" downloads, with that name and its contents unchanged

### AC2: A renamed file downloads with its new name
Given "set-plan.pdf" has been renamed "set-plan-v2.pdf" directly in file storage
When someone opens the Scenery page and chooses its tile
Then it downloads as "set-plan-v2.pdf"

### AC3: Every signed-in role can download
Given "jo" has no permissions
When jo chooses a tile
Then the file downloads

### AC4: The download link expires within minutes
Given someone has been given the download link for "set-plan.pdf"
When the link is used more than 5 minutes later
Then file storage refuses it

### AC5: Nobody signed out gets a link
Given someone who isn't signed in
When they ask the API for a download link
Then it answers 401

### AC6: A file always downloads, never opens in the app
Given "Opening Number" has "notes.html", containing a script
When someone chooses its tile
Then the file downloads, and nothing in it runs in the app

### AC7: A file that's gone says so
Given "set-plan.pdf" was deleted from file storage after the page loaded
When someone chooses its tile
Then the page says "set-plan.pdf isn't there any more." and refreshes the grid

### AC8: Each tile is named for what it does
Given someone using a screen reader on the Scenery page for "Opening Number"
When they reach the tile for "set-plan.pdf"
Then it's named "Download set-plan.pdf", with the file's type

## Notes

- FRs: FR10
- Depends on: production-scenery.E2.S1
- The link is a short-lived one made by the API for one file of one item (ADR from E2.S1), and the response tells the browser to save the file under its stored name, not display it (PRD security NFR).
- Downloading isn't recorded on the Usage page (FR15).
- Out of scope: previews in the app beyond thumbnails (PRD non-goals).
