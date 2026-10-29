---
id: production-scenery.E2.S2
title: Open or download a scenery file
epic: E2
status: done
---

## Story

As someone on the production team, I want to open or download an item's scenery file by choosing its tile, so that I can look at the set plan on my phone at rehearsal.

## Acceptance criteria

### AC1: Choosing a PDF, image or text file opens it in a new tab
Given "Opening Number" has "set-plan.pdf"
When someone chooses its tile
Then "set-plan.pdf" opens in a new browser tab, named "set-plan.pdf", its contents unchanged
And the Scenery page stays open behind it

### AC2: Choosing any other file downloads it
Given "Opening Number" has "build-list.xlsx"
When someone chooses its tile
Then "build-list.xlsx" downloads, with that name and its contents unchanged

### AC3: A renamed file keeps its new name
Given "build-list.xlsx" has been renamed "build-list-v2.xlsx" directly in file storage
When someone opens the Scenery page and chooses its tile
Then it downloads as "build-list-v2.xlsx"

### AC4: Every signed-in role can open and download
Given "jo" has no permissions
When jo chooses a tile
Then the file opens or downloads, as it does for an admin

### AC5: The link expires within minutes
Given someone has been given the link for "set-plan.pdf"
When the link is used more than 5 minutes later
Then file storage refuses it

### AC6: Nobody signed out gets a link
Given someone who isn't signed in
When they ask the API for a download link
Then it answers 401

### AC7: A file that could run script always downloads
Given "Opening Number" has "notes.html" and "plan.svg", each containing a script
When someone chooses either tile
Then the file downloads, and nothing in it runs

### AC8: A file that's gone says so
Given "set-plan.pdf" was deleted from file storage after the page loaded
When someone chooses its tile
Then the page says "set-plan.pdf isn't there any more." and refreshes the grid

### AC9: Each tile is named for what it does
Given someone using a screen reader on the Scenery page for "Opening Number"
When they reach the tiles
Then "set-plan.pdf" is named "Open set-plan.pdf, PDF file"
And "build-list.xlsx" is named "Download build-list.xlsx, XLSX file"
And a file with no extension, such as "notes", is named "Download notes"

### AC10: Office files, PDFs and images show their own icons
Given "Opening Number" has "plan.pdf", "notes.docx", "old-notes.doc", "build.xlsx", "costs.xls", "pitch.pptx", "pitch-2026.ppt", "Backdrop.png" and "PHOTO.JPEG"
When someone opens its Scenery page
Then "plan.pdf" shows the PDF icon, the two Word files the Word icon, the two Excel files the Excel icon, the two PowerPoint files the PowerPoint icon, and the two images the image icon, whatever the case of their names

### AC11: Any other file shows the general file icon
Given "Opening Number" has "model.skp", "build-list.csv" and "readme"
When someone opens its Scenery page
Then each shows the general file icon
And every icon is hidden from screen readers, so each tile is still announced by its name (AC9)

## Notes

- **Type icons added 2026-10-29** (the maintainer, after the PR was opened): AC10 and AC11 come from E2.S3, which keeps the thumbnails. Font Awesome's free set has no GIF, JPG or PNG icons, so every image type shares the image icon (the maintainer's choice; ADR 0013 keeps to the free set). Images are GIF, JPG, JPEG, PNG, WebP, SVG, BMP, TIFF, HEIC and AVIF. Word, Excel, PDF and PowerPoint icons are in their apps' colours (blue, green, red, orange, each at least 3:1 on white); the image and general file icons stay grey (the maintainer's choice).

- **Agreed at `write-story` (2026-10-29)**:
  - **Open, not only download** (the maintainer, during implementation): PDFs, JPG, PNG, GIF, WebP and plain text open in a new tab, in the browser's own viewer; every other type, HTML and SVG among them, downloads. The type comes from the name's extension, never from what storage says, so a file can't choose to open. The PRD's FR10, security NFR, accessibility NFR, non-goals and risks changed to match.
  - The API answers `GET /api/productions/{productionId}/items/{itemId}/scenery-file-link?name=<name>` with a link to the file, or 404 if it isn't there (AC8). Hosted, the link is an S3 link signed for 5 minutes (AC5), on S3's address, never the app's. It tells the browser the file's type and name: `inline` with its real type for those that open, `attachment` with `application/octet-stream` for the rest (AC7). The API function gets `s3:GetObject` on scenery keys only. New dependency: `@aws-sdk/s3-request-presigner`.
  - Locally (`pnpm demo`, and the API run without `FILES_BUCKET`), the dev server serves the local files folder at `/api/local-files/<key>`, unsigned and without an expiry, with the same headers, plus `nosniff`, and a `sandbox` policy on downloads, as it's on the app's own address. So AC5 is checked on the signed S3 link's expiry, not against real S3.
  - The new tab opens on the click, before the link arrives, so phones don't block it as a pop-up; it's cut off from the app before it goes to the file, and closed if the file is gone.
  - The design is recorded as an "Opening and downloading" section amending ADR 0030, not a new ADR.
  - A tile's type is its extension in capitals (AC9).

- FRs: FR10
- Depends on: production-scenery.E2.S1
- The link is a short-lived one made by the API for one file of one item (ADR from E2.S1), and the response tells the browser the file's type and stored name: show it for PDFs, images and text, save it for the rest (PRD security NFR).
- Downloading isn't recorded on the Usage page (FR15).
- Out of scope: previews in the app beyond thumbnails (PRD non-goals).
- The grid of tiles became a list, one row per file, on 2026-10-29 (production-scenery.E2.S4; PRD FR7).
