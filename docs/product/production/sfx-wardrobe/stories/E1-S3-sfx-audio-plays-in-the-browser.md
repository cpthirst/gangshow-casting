---
id: production-sfx-wardrobe.E1.S3
title: Play SFX audio files in the browser
epic: E1
status: ready
---

## Story

As someone on the Tech team, I want an SFX audio file to play when I choose it, so that I can hear a cue straight away without downloading it and finding a player.

## Acceptance criteria

### AC1: Audio files on SFX show the audio file icon
Given "Opening Number" has "thunder.mp3", "applause.wav", "intro.m4a", "chime.aac" and "wind.ogg" in its SFX files
When anyone signed in opens its SFX page
Then each of them shows the audio file icon

### AC2: Choosing an audio file plays it in a new tab
Given "Opening Number" has "thunder.mp3" in its SFX files
When anyone signed in chooses it
Then it opens in a new tab, where the browser's own player plays it
And it doesn't download

### AC3: The type a file plays as comes from its name
Given "Opening Number" has "notes.mp3.html" in its SFX files
When anyone chooses it
Then it downloads, and never opens in the browser

### AC4: Other SFX files behave as on Scenery
Given "Opening Number" has "cue-sheet.pdf" and "cues.docx" in its SFX files
When anyone opens its SFX page
Then "cue-sheet.pdf" shows the PDF icon and opens in a new tab, and "cues.docx" shows the Word icon and downloads

### AC5: Audio on Scenery and Wardrobe still downloads
Given "Opening Number" has "thunder.mp3" in its scenery files and in its Wardrobe files
When anyone chooses it on either page
Then it shows the general file icon, and downloads

### AC6: An audio file's name says it opens
Given someone using a screen reader
When they reach "thunder.mp3" on the SFX page
Then it's named "Open thunder.mp3, MP3 file"

## Notes

- FRs: FR6
- Depends on: production-sfx-wardrobe.E1.S1
- MP3, WAV, M4A, AAC and OGG can't run script, so they may open in the browser (PRD security). The type is set from the name, as for Scenery's PDFs and images, and only for files on the SFX page.
- A long cue whose short-lived link expires may stop seeking; reopening it from its row gets a fresh link (PRD risks).
- Out of scope: a player on the page itself (PRD non-goals).
