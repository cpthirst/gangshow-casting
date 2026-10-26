---
id: stage-props.E5.S1
title: Generate the props list in Word
epic: E5
status: done
---

## Story

As anyone on the production team, I want to download the whole show's props list as a Word document, so that the props team can print it for backstage and nobody has to retype it.

## Acceptance criteria

### AC1: Everyone can generate the list
Given "jo" has no permissions
When jo opens the Props page
Then there's a Generate Props List button
And choosing it downloads a Word document

### AC2: The file is named like the other exports
Given the production is "Gang Show 2027" and it's 25 October 2026
When someone generates the props list
Then the file is named for the production and the date, as the Item Overview export is, ending "props list.docx"

### AC3: The document follows the running order
Given the latest saved running order has two halves
When the document is opened
Then it has the production's title, then each half's name, then each of its items in order as a headed section, with its number and title, as the Item Overview export does

### AC4: Each item has a props table
Given Pirate Sketch has "Telescope" linked to Captain (Sam Taylor), and "3 umbrellas" linked to Pirate 1 (Jo Brown) and Pirate 2 (uncast)
When the document is opened
Then under Pirate Sketch is a table with the columns Prop, Character and Cast
And Telescope's row shows Captain and Sam Taylor
And 3 umbrellas shows Pirate 1 with Jo Brown, and Pirate 2 with "uncast"

### AC5: A prop with no roles
Given Pirate Sketch has "Treasure chest" with no roles
When the document is opened
Then Treasure chest has a row with empty Character and Cast cells

### AC6: Props notes come first
Given Pirate Sketch has the props notes "Chest set stage left before the blackout"
When the document is opened
Then those notes appear under its heading, before its table
And an item without props notes has none shown

### AC7: Items with no props are included
Given Finale has no props
When the document is opened
Then Finale has its heading and says "No props"

### AC8: Items not in the printed programme are included and marked
Given "Interval Announcement" isn't in the printed programme
When the document is opened
Then it has a section, with no number, marked "Not in printed programme"

### AC9: Props and characters are in the page's order
Given an item's props and roles
When the document is opened
Then the props are alphabetical, numbers by value, and each prop's roles are in the item's role order, as on the item's props page

### AC10: The list is current when generated
Given someone recast Captain after the Props page loaded
When the props list is generated
Then it shows the cast as saved at that moment

### AC11: Only names and props are in the document
Given cast members with age bands, sections, groups and Singing or Acting notes
When the document is opened
Then it holds cast members' first names and surnames only, and no other cast data

### AC12: Generating is announced, and a failure is said
Given someone chooses Generate Props List
When the document is made
Then it says the props list was generated, and the use is recorded on the Usage page as the other exports are
And if it can't be made, it says "Couldn't generate the props list. Try again." and keeps the button ready

### AC13: The show's logo heads every page
Given any production
When the document is opened
Then each page's header shows the Chester Gang Show logo (`apps/web/src/assets/logo-small.jpg`), aligned left

## Notes

- FRs: FR22, FR23
- Depends on: stage-props.E4.S3, stage-props.E4.S5
- Built in the browser with `docx`, loaded only when the button is pressed, as ADR 0022 sets for the Word exports. The new document's contents need adding to that ADR's "What the files may hold" (a "Later changes" note, or an amendment via the `adr` skill).
- Text goes in as plain text runs, never fields or HTML (ADR 0022).
- A new kind of export for usage recording (the Usage page's export names) comes with this story.
- Out of scope: an Excel props export (PRD non-goal).
