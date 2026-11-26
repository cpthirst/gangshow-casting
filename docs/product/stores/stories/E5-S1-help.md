---
id: stores.E5.S1
title: Describe Stores in Help and Welcome
epic: E5
status: ready
---

## Story

As a volunteer new to iCUE, I want Help and the Welcome page to tell me what Stores is and what I can do there, so that I use it without being shown.

## Acceptance criteria

### AC1: Help has an entry for the store page
Given anyone opens Help
Then it has one entry for the store page, beside the other pages' entries

### AC2: It says what Stores holds and that it outlasts each show
Given the Help entry for the store page
Then it says Stores keeps photos of what the show holds in store, and that they stay whichever show year is chosen

### AC3: It says who can change each store, from the shared list
Given the Help entry for the store page
Then it says who can change the Scenery, Props and Wardrobe stores, read from the shared list of stores, so it names Stage and Wardrobe and admins, and not Director

### AC4: It says what can be done there
Given the Help entry for the store page
Then it mentions adding many photos at once, the pencil for a name and description, and the Word catalogue of four photos to a page

### AC5: It repeats the safeguarding rule
Given the Help entry for the store page
Then it says not to photograph cast members, and not to name them in descriptions

### AC6: The production file pages' Help says they take many files
Given the Help entries for the Scenery, SFX and Wardrobe pages
Then each says many files can be added at once

### AC7: Welcome mentions Stores
Given anyone opens the Welcome page
Then it mentions Stores

### AC8: The store page's help button opens its entry
Given anyone is on the Props stores page
When they choose its help button
Then Help opens at the store page's entry

## Notes

- FRs: FR25
- Depends on: stores.E4.S2
- Help lives in `apps/web/src/utils/help.ts`; the who-can-change line comes from the shared list of stores, as departments' lines come from `whoCanChangeLine` (CLAUDE.md, "Say a thing once").
- Check structure, not wording (CLAUDE.md, "Don't pin content"), except AC5, which is safeguarding.
- It changes the Help page's code, so it is test-first, not a documentation story.
