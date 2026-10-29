---
id: production-scenery.E2.S3
title: Show thumbnails and type icons on scenery tiles
epic: E2
status: draft
---

## Story

As someone on the production team, I want each scenery tile to show a picture of an image or an icon for its type, so that I can spot the right file at a glance.

## Acceptance criteria

### AC1: Images show a thumbnail
Given "Opening Number" has "Backdrop.png" and "stage-left.jpg"
When someone opens its Scenery page
Then each of their tiles shows a thumbnail of the image

### AC2: Office files and PDFs show their own icons
Given "Opening Number" has "plan.pdf", "notes.docx", "build.xlsx" and "pitch.pptx"
When someone opens its Scenery page
Then each tile shows a different icon: PDF, Word, Excel and PowerPoint

### AC3: Any other type shows a general file icon
Given "Opening Number" has "model.skp" and "readme"
When someone opens its Scenery page
Then each shows the general file icon

### AC4: An image whose preview can't show gets an image icon
Given "Opening Number" has "broken.png", which isn't a readable image
When someone opens its Scenery page
Then its tile shows an image icon, and the page shows no broken-image symbol

### AC5: The type comes from the name, whatever its case
Given "PLAN.PDF" and "Photo.JPEG"
When someone opens the Scenery page
Then "PLAN.PDF" shows the PDF icon and "Photo.JPEG" a thumbnail

### AC6: The grid shows before the thumbnails
Given an item with 30 files, 20 of them images
When someone opens its Scenery page
Then the grid of names, sizes and icons shows first, and each thumbnail fills in as it loads

### AC7: Thumbnails and icons are hidden from screen readers
Given someone using a screen reader on a Scenery page
When they move through the tiles
Then each tile is announced by its name only, as in E2.S2, and not by its thumbnail or icon

## Notes

- FRs: FR7
- Depends on: production-scenery.E2.S2, whose short-lived links the thumbnails reuse
- Performance NFR: thumbnails mustn't download every full-size image on a phone connection where a smaller preview is possible. If that needs previews made and stored beside the files (for example on upload), the stored previews mustn't show as files in the grid, and must follow a rename or delete at source, or be dropped when their file is. Record the choice as a change to the file storage ADR.
- Icons come from Font Awesome (ADR 0013).
