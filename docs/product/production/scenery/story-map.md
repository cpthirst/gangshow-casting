---
feature: production-scenery
status: approved
prd: ./prd.md
---

# Production scenery: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | A Director permission that changes every Production department, but not Casting or the show | FR1, FR2, FR3, FR4 |
| E2 | Each item's scenery files, uploaded, downloaded and deleted by Stage, Tech and Directors | FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13 |
| E3 | Help and Usage follow the Scenery page and the Director permission | FR14, FR15 |

## E1: Director

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-scenery.E1.S1](stories/E1-S1-director-permission-in-the-api.md) | Accounts can have Director, a new sign-in group beside Casting, Stage, Tech and Wardrobe. A change route can name more than one permission, any of which allows it. Props and props notes accept Stage or Director, and casting routes still refuse Director. The props pages show their controls to Directors. Includes the ADR amending ADR 0026 | FR1, FR2, FR4 | (none) | done |
| [production-scenery.E1.S2](stories/E1-S2-director-on-accounts-and-local-switch.md) | Director is a tick box on the Accounts page, when creating an account and later, with the confirmation saying what it can change. The "Local role" switch in dev and the demo offers it, and refusal and read-only lines name it where they name permissions | FR1, FR3 | E1.S1 | done |

## E2: Scenery files

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-scenery.E2.S1](stories/E2-S1-list-scenery-files.md) | Walking skeleton: an item's Scenery page replaces "Coming soon" with a grid of its files, sorted by name, each with its name and size and a general file icon, and says when there are none. The API lists the files from new private file storage, scoped to the production and item, never public, so names live in storage, not the database, and a file renamed there shows on the next load. Stage, Tech and Director get the Edit view; everyone else the read-only line. Includes the ADR for file storage | FR5, FR6, FR7, FR12 | E1.S1 | done |
| [production-scenery.E2.S7](stories/E2-S7-upload-a-scenery-file.md) | Admin, Stage, Tech or Director can upload one file of up to 100 MB, straight to file storage, under the "no photos of cast members" line. A file over the limit, or a failed upload, says why. Split from E2.S1 at `write-story` | FR5, FR8, FR12 | E2.S1 | draft |
| [production-scenery.E2.S2](stories/E2-S2-download-a-scenery-file.md) | Anyone can choose a tile to open its file in a new tab (PDFs, images, plain text) or download it (everything else, HTML and SVG among them), with its stored name, through a link that expires within minutes. Nothing opens as a page of the app. Each tile shows an icon for its type: PDF, Word, Excel, PowerPoint, image, or a general file icon (moved from E2.S3) | FR7, FR10 | E2.S1 | done |
| [production-scenery.E2.S3](stories/E2-S3-thumbnails-and-type-icons.md) | Dropped on 2026-10-29: no thumbnails, image tiles keep the image icon. Type icons shipped with E2.S2 | | | dropped |
| [production-scenery.E2.S4](stories/E2-S4-delete-a-scenery-file.md) | Admin, Stage, Tech or Director see a trash icon on each tile, which deletes the file for everyone after "Remove set-plan.pdf? This can't be undone." The API refuses deletes from everyone else | FR5, FR7, FR11 | E2.S1 | done |
| [production-scenery.E2.S5](stories/E2-S5-upload-progress-and-replacing.md) | The upload shows its progress, and a failed one can be tried again. A file with the same name as one on the item replaces it after "Replace set-plan.pdf?" | FR8, FR9 | E2.S7 | draft |
| [production-scenery.E2.S6](stories/E2-S6-files-removed-with-their-item.md) | Saving a running order without an item deletes that item's scenery files too, in the removal clean-up that already deletes its notes and roles. Nothing goes before the save, and the next save repairs a failed clean-up | FR13 | E2.S1 | draft |

## E3: Help and Usage

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-scenery.E3.S1](stories/E3-S1-welcome-and-help.md) | Welcome and Help describe the Scenery page (uploading, replacing, downloading and deleting files, and the "no photos of cast members" rule) and the Director permission: what it can and can't change | FR14 | E1.S2, E2.S5 | draft |
| [production-scenery.E3.S2](stories/E3-S2-scenery-page-visits.md) | The Usage page records visits to each item's Scenery page, as it records the casting item pages. Uploads, downloads and deletes aren't recorded | FR15 | E2.S1 | draft |

## Order

E1.S1 → E1.S2 → E2.S1 → E2.S7 → E2.S2 → E2.S4 → E2.S5 → E2.S6 → E3.S2 → E3.S1

- E1.S1 goes first so that scenery's routes can name Stage, Tech and Director from the start. It also lets "any of these permissions" land in the ADR before the first route needs it.
- E2.S1 adds file storage (infra, ADR, the local dev and demo stores) as well as the page, so uploading was split out at `write-story` as E2.S7 (IDs aren't renumbered).
- E2.S3 (thumbnails) was dropped on 2026-10-29.
- E2.S4 and E2.S6 need only E2.S1, and E2.S5 needs E2.S7, so after E2.S7 they can go in any order.
- E3.S1 goes last, once everything it describes exists.

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1, E1.S2 |
| FR2 | E1.S1 |
| FR3 | E1.S2 |
| FR4 | E1.S1 |
| FR5 | E2.S1, E2.S7, E2.S4 |
| FR6 | E2.S1 |
| FR7 | E2.S1, E2.S2, E2.S4 |
| FR8 | E2.S7, E2.S5 |
| FR9 | E2.S5 |
| FR10 | E2.S2 |
| FR11 | E2.S4 |
| FR12 | E2.S1, E2.S7 |
| FR13 | E2.S6 |
| FR14 | E3.S1 |
| FR15 | E3.S2 |
