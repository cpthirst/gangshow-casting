---
feature: casting-overview-by-item
status: approved
prd: ./prd.md
---

# Casting overview by item: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | See every item's roles and cast in show order on the Overview | FR1, FR2, FR3, FR4, FR5, FR6 |
| E2 | The team takes the show's casting into Word: an Item Overview document and a casting sheet per cast member | FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15 |

## E1: See every item's roles and cast in show order

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-overview-by-item.E1.S1](stories/E1-S1-by-item-view.md) | A third "By item" choice on the Overview's view switch lists every item in show order under its half's name, with its title and programme number, and under each a table of Role name, Role type and Cast (all names for an ensemble), roles ordered by size then name; the same read-only view for every team role (walking skeleton) | FR1, FR2, FR4, FR6 | (none) | done |
| [casting-overview-by-item.E1.S2](stories/E1-S2-unprinted-and-uncast.md) | Items left out of the printed programme show in red italics with no number, an empty role says "Uncast", and an item with no roles says it has none yet | FR3, FR5 | E1.S1 | done |

## E2: The team takes the show's casting into Word

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-overview-by-item.E2.S1](stories/E2-S1-word-export-decision.md) | Record in an ADR the use of the `docx` library, whether the browser or the server builds the documents, and how that relates to ADRs 0019 and 0021 (documentation story) | (none: NFR) | (none) | done |
| [casting-overview-by-item.E2.S2](stories/E2-S2-export-item-overview.md) | A blue "Export to Word" button on the By item view, for every team role, downloads a Word document named for the production: Heading 1 the title, Heading 2 each half, Heading 3 each item, with a roles table under each, matching the screen (unprinted items and "Uncast" included); the button shows it's busy, announces success and reports failure | FR7, FR8, FR14, FR15 | E1.S2, E2.S1 | done |
| [casting-overview-by-item.E2.S3](stories/E2-S3-casting-sheet-pages.md) | A blue "Export to Word" button on the By person view, for every team role, downloads a Word document named for the production with one page per cast member (everyone, even with no parts), ordered by section then surname then first name, each headed with the show title, name, section and group; busy, success and failure as for the Item Overview | FR7, FR9, FR10, FR11, FR14, FR15 | E2.S2 | done |
| [casting-overview-by-item.E2.S4](stories/E2-S4-casting-sheet-grid.md) | Each casting sheet has an Item Name / Am I cast / Costume from home table: a row per printed item in show order with its number and a break between the halves, a tick where the person holds any role in that item, and "Costume from home" left blank with room to write | FR12, FR13 | E2.S3 | ready |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E1.S2 |
| FR4 | E1.S1 |
| FR5 | E1.S2 |
| FR6 | E1.S1 |
| FR7 | E2.S2, E2.S3 |
| FR8 | E2.S2 |
| FR9 | E2.S3 |
| FR10 | E2.S3 |
| FR11 | E2.S3 |
| FR12 | E2.S4 |
| FR13 | E2.S4 |
| FR14 | E2.S2, E2.S3 |
| FR15 | E2.S2, E2.S3 |
