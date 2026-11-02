---
feature: production-sfx-wardrobe
status: approved
prd: ./prd.md
---

# Production SFX and Wardrobe: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | Each item's SFX and Wardrobe pages hold its files and notes, as Scenery's do, and SFX plays audio in the browser | FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9 |
| E2 | The Overview, Usage, Welcome and Help follow the new pages | FR10, FR11, FR12, FR13 |

## E1: SFX and Wardrobe files

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-sfx-wardrobe.E1.S1](stories/E1-S1-sfx-files-and-notes.md) | Walking skeleton: Scenery's routes, file store, page, upload, notes and clean-up take a department, with Scenery's tests passing unchanged. The SFX page gets the whole set: list, upload (choose, drag, progress, replace), open or download, delete, notes, the read-only line, and its files and notes deleted with their item. The API reaches `sfx` files as well as scenery's. Includes the ADR amending ADR 0030 | FR1, FR2, FR3, FR5, FR7, FR8, FR9 | (none) | done |
| [production-sfx-wardrobe.E1.S2](stories/E1-S2-wardrobe-files-and-notes.md) | The same set for Wardrobe, changed by Wardrobe, Director and Admins, with "Costume designs and images only: no photos of cast members." on the upload area. The API reaches `wardrobe` files | FR1, FR2, FR3, FR4, FR5, FR7, FR8, FR9 | E1.S1 | done |
| [production-sfx-wardrobe.E1.S3](stories/E1-S3-sfx-audio-plays-in-the-browser.md) | On SFX only, MP3, WAV, M4A, AAC and OGG files show the audio file icon and open in a new tab to play, instead of downloading. Audio on Scenery and Wardrobe still downloads | FR6 | E1.S1 | done |

## E2: Overview, Usage and Help

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-sfx-wardrobe.E2.S1](stories/E2-S1-overview-counts-notes-and-usage.md) | The Overview's SFX and Wardrobe columns count files instead of a dash, their notes appear under each row after scenery and props notes, and the Usage page records visits to both pages | FR10, FR11, FR13 | E1.S2 | ready |
| [production-sfx-wardrobe.E2.S2](stories/E2-S2-welcome-and-help.md) | Welcome and Help describe both pages, who can change each, SFX audio opening in a new tab, and Wardrobe's rule | FR12 | E1.S2, E1.S3 | ready |

## Order

E1.S1 → E1.S2 → E1.S3 → E2.S1 → E2.S2

- E1.S1 moves Scenery's code over to serve any department, so it will pass the ~400-line guideline: files are renamed and Scenery's tests move with them. Kept whole by choice (2026-10-30), because the move alone would deliver nothing a user can see. E1.S2 then mostly adds Wardrobe's settings.
- E1.S3 and E2.S1 can go in either order once their dependencies are done.
- E2.S2 goes last, once everything it describes exists. It changes the Help and Welcome pages' code, so it is test-first, as production-scenery.E3.S1 was.

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1, E1.S2 |
| FR2 | E1.S1, E1.S2 |
| FR3 | E1.S1, E1.S2 |
| FR4 | E1.S2 |
| FR5 | E1.S1, E1.S2 |
| FR6 | E1.S3 |
| FR7 | E1.S1, E1.S2 |
| FR8 | E1.S1, E1.S2 |
| FR9 | E1.S1, E1.S2 |
| FR10 | E2.S1 |
| FR11 | E2.S1 |
| FR12 | E2.S2 |
| FR13 | E2.S1 |
