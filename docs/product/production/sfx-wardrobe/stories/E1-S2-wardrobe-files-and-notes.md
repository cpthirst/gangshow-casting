---
id: production-sfx-wardrobe.E1.S2
title: Keep each item's Wardrobe files and notes on its Wardrobe page
epic: E1
status: ready
---

## Story

As someone on the Wardrobe team, I want each item's costume designs and reference images on its Wardrobe page, so that I can find the latest version at a fitting.

## Acceptance criteria

### AC1: The Wardrobe page lists the item's files
Given "Opening Number" has "jacket-pattern.pdf" (1.2 MB) and "colour-swatch.png" (300 KB) in its Wardrobe files
When anyone signed in opens its Wardrobe page
Then "Coming soon" is gone, and the page lists "colour-swatch.png" then "jacket-pattern.pdf", each with its type icon, full name and size
And it keeps its link back to the Overview, its Previous and Next links, and its not-found message

### AC2: An item with no Wardrobe files says so
Given "Finale" has no Wardrobe files
When someone with Wardrobe opens its Wardrobe page
Then it says the item has no Wardrobe files yet, and how to add one

### AC3: The upload area states the photos rule
Given "kit" has Wardrobe
When kit opens the Wardrobe page for "Opening Number"
Then the upload area says "Costume designs and images only: no photos of cast members."

### AC4: Wardrobe, Director and admins can upload, replace and delete
Given "kit" has Wardrobe
When kit uploads "jacket-pattern.pdf", uploads it again and confirms the replace, then removes it and confirms
Then the page shows the progress, replaces the file after "Replace jacket-pattern.pdf? The old copy can't be brought back.", and removes it after "Remove jacket-pattern.pdf? This can't be undone."
And someone with Director, or an admin, can do the same

### AC5: Choosing a file opens or downloads it
Given "Opening Number" has "colour-swatch.png" and "fabric-order.xlsx" in its Wardrobe files
When anyone signed in chooses "colour-swatch.png"
Then it opens in a new tab
And choosing "fabric-order.xlsx" downloads it, keeping its name

### AC6: Wardrobe notes are kept per item
Given "kit" has Wardrobe
When kit writes "Gold jackets for the chorus" in the Wardrobe notes for "Opening Number"
Then anyone opening that page later sees the note, and no other item's or department's notes change

### AC7: Anyone else can view but not change, and the API refuses them
Given "lee" has Tech only
When lee opens the Wardrobe page for "Opening Number"
Then lee sees the files and notes, with no upload area, trash icons or note editing
And the line "You can view the wardrobe, but not change it: only Wardrobe, Director and admins can."
And the API refuses lee's upload, delete and note change with 403 saying "You can view the wardrobe, but not change it."

### AC8: Wardrobe files are kept apart from the other departments'
Given "Opening Number" has "set-plan.pdf" in scenery, "thunder.mp3" in SFX and "jacket-pattern.pdf" in Wardrobe
When anyone opens its Wardrobe page
Then it lists only "jacket-pattern.pdf"
And a Wardrobe request for "../sfx/thunder.mp3" is refused, and "thunder.mp3" is untouched

### AC9: Wardrobe files and notes go with their item
Given "Cut Sketch" has "hat.jpg" in its Wardrobe files and a Wardrobe note
When the running order is saved without "Cut Sketch"
Then its Wardrobe files and Wardrobe note are deleted, along with its scenery and SFX files
And nothing is deleted before the save

## Notes

- FRs: FR1, FR2, FR3, FR4, FR5, FR7, FR8, FR9
- Depends on: production-sfx-wardrobe.E1.S1
- Files are kept under `<production>/<item id>/wardrobe/`. The API's access to the bucket widens to `wardrobe` keys (the ADR from E1.S1 covers it), so this needs the infra and security reviews.
- Wardrobe's photos rule stands in for checks, as Scenery's does (PRD FR4, ADR 0010).
- Out of scope: the Overview's Wardrobe count and notes, and Usage (E2.S1), Help (E2.S2).
