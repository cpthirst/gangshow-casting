---
id: production-sfx-wardrobe.E2.S2
title: Describe SFX and Wardrobe on Welcome and Help
epic: E2
status: done
---

## Story

As a volunteer new to the SFX or Wardrobe pages, I want Welcome and Help to explain them, so that I know what I can do there and what not to upload.

## Acceptance criteria

### AC1: Help describes the SFX page
Given anyone signed in
When they open Help, or the SFX page's help button
Then it describes uploading, replacing, opening, downloading and deleting SFX files, the SFX notes, that Tech, Director and admins can change them, and that MP3, WAV, M4A, AAC and OGG files play in a new tab

### AC2: Help describes the Wardrobe page and its rule
Given anyone signed in
When they open Help, or the Wardrobe page's help button
Then it describes the same for Wardrobe files and notes, that Wardrobe, Director and admins can change them, and the rule "Costume designs and images only: no photos of cast members."

### AC3: Welcome mentions both pages
Given anyone signed in
When they open Welcome
Then it says the Overview's SFX and Wardrobe buttons open each item's files and notes, as it does for Scenery

### AC4: Nothing still says SFX or Wardrobe is coming soon
Given anyone signed in
When they read Welcome and Help
Then neither says SFX or Wardrobe is "Coming soon", and Mic plot still does

## Notes

- FRs: FR12
- Depends on: production-sfx-wardrobe.E1.S2, production-sfx-wardrobe.E1.S3
- Changes the Help and Welcome pages' code, so it is test-first, as production-scenery.E3.S1 was.
- If a short-lived link stops a long cue, Help says to choose it again (PRD risks).
- Out of scope: the Mic plot page.
