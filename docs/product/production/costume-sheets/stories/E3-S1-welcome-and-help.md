---
id: production-costume-sheets.E3.S1
title: Welcome and Help describe costumes and the costume sheets
epic: E3
status: ready
---

## Story

As a volunteer new to the Wardrobe page, I want Help and the Welcome page to say what the Costumes section and the costume sheets are for and who can change them, so that I know what to record and what to keep out.

## Acceptance criteria

### AC1: Help for the Wardrobe page covers Costumes
Given anyone opens Help from an item's Wardrobe page
When they read the Wardrobe entry
Then it has a line for the Costumes section saying it holds, for each cast member in each role, what Wardrobe provides, what they bring and the team's notes, that the rows follow the casting, and that sizes, measurements and photos stay out
And it says Wardrobe, Director and admins can change it, in the words every page uses

### AC2: Help for the Production Overview covers Generate Costume Sheets
Given anyone opens Help from the Production Overview
When they read its entry
Then it has a line for "Generate Costume Sheets" beside Generate Props List and Generate Mic Plot, saying it saves a Word sheet per cast member with their role and costume for every item, that it holds under-18s' names, and that everyone can use it

### AC3: Help for the Casting Overview describes the casting sheets' columns
Given anyone opens Help from the Casting Overview
When they read the Export to Word line
Then it describes the casting sheets without "Costume from home"

### AC4: The Wardrobe permission's line
Given anyone reads Help's permissions section
When they read the Wardrobe permission
Then it says Wardrobe changes what the cast wear in each item: its costumes, files and notes

### AC5: The Welcome page names costumes and the costume sheets
Given anyone opens the Welcome page
When they read what the Wardrobe page and the Production Overview do
Then the Wardrobe page is described as holding each item's costumes as well as its files, and the costume sheets appear with the other exports

## Notes

- FRs: FR13
- Depends on: production-costume-sheets.E1.S3, production-costume-sheets.E2.S2
- Help and Welcome are code (`apps/web/src/utils/help.ts`, `WelcomePage.vue`), so this is test-first, not a documentation story: check structure (the lines exist, the access is the shared label), not exact wording, except the safeguarding line about sizes, measurements and photos.
- Out of scope: nothing else; this is the last story.
