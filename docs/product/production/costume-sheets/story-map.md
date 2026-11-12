---
feature: production-costume-sheets
status: approved
prd: ./prd.md
---

# Production costume sheets: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | Each item's Wardrobe page lists who wears what, a row per cast member per role, which Wardrobe, Director and Admins fill in and which follows the casting | FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8 |
| E2 | The Word sheets: the casting sheets lose their write-in column, and the Production Overview generates a costume sheet per cast member | FR9, FR10, FR11, FR12, FR14 |
| E3 | Welcome and Help describe it | FR13 |

## E1: Costumes on the Wardrobe page

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-costume-sheets.E1.S1](stories/E1-S1-files-heading-and-costume-rows.md) | The Scenery, SFX and Wardrobe pages head their files **Files**. The Wardrobe page gains a **Costumes** section between Files and its notes, with a row per cast member per role in the item's role order, a row saying so for an uncast role, and a line when the item has no roles. Nothing to edit yet | FR2, FR3 | (none) | done |
| [production-costume-sheets.E1.S2](stories/E1-S2-edit-a-costume-row.md) | Each row shows From Wardrobe, From Cast Member and Notes. Wardrobe, Director and Admins get a pencil that turns the row into a form with all three fields, Save and Cancel, Escape cancelling, one row in edit at a time, a save announced, and the line that sizes and measurements don't go here. The API stores costumes per item, role and cast member in the current production, refuses changes outside those permissions, a field over 500 characters, a role not in the item or a cast member not in it, and removes an item's costumes in the shared clean-up when the item is cut | FR1, FR4, FR5, FR6, FR7, FR8 | E1.S1 | done |
| [production-costume-sheets.E1.S3](stories/E1-S3-costumes-follow-the-casting.md) | A save is refused, showing the row's current text, when someone else saved it first. A recast shows the new cast member's empty row and hides the old one's text; removing a role from an item, or deleting a cast member, removes their costumes | FR7, FR8 | E1.S2 | done |

## E2: The sheets

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-costume-sheets.E2.S1](stories/E2-S1-casting-sheets-drop-costume-from-home.md) | The casting sheets lose their **Costume from home** column: #, Item Name and Cast, Item Name taking the width, otherwise unchanged | FR12 | (none) | ready |
| [production-costume-sheets.E2.S2](stories/E2-S2-generate-costume-sheets.md) | **Generate Costume Sheets** on the Production Overview, beside Generate Props List and Generate Mic Plot: one page per cast member laid out as the casting sheets are, sharing their document, with #, Item Name, Role, From Wardrobe and From Cast Member, a row per role held in an item and empty costume columns where they're not in it. Busy, announced and retried as the other exports, and recorded on the Usage page | FR9, FR10, FR11, FR14 | E1.S2, E2.S1 | ready |

## E3: Help

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-costume-sheets.E3.S1](stories/E3-S1-welcome-and-help.md) | Welcome and Help describe the Costumes section, who changes it, that it follows the casting, that sizes, measurements and photos stay out, Generate Costume Sheets, and the casting sheets' columns; the Wardrobe permission's line says it changes costumes too | FR13 | E1.S3, E2.S2 | ready |

## Order

E1.S1 → E1.S2 → E1.S3 → E2.S1 → E2.S2 → E3.S1

- E1.S2 is the biggest: a shared schema, a store contract with file and Dynamo stores, two routes, the clean-up and the row form. It may pass the ~400-line guideline; it stays whole because a store without a page, or a form without a route, would deliver nothing a user can see, and a new kind of per-item data joins the clean-up in the story that adds it (CLAUDE.md). The form should share what the prop card's pencil-to-form flow has rather than copy it.
- E2.S1 has no dependencies and can go first or at any point before E2.S2; it comes before E2.S2 so that the shared sheet document is changed once, then extended.
- E3.S1 goes last, once everything it describes exists. It changes the Help and Welcome pages' code, so it is test-first.

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S2 |
| FR2 | E1.S1 |
| FR3 | E1.S1 |
| FR4 | E1.S2 |
| FR5 | E1.S2 |
| FR6 | E1.S2 |
| FR7 | E1.S2, E1.S3 |
| FR8 | E1.S2, E1.S3 |
| FR9 | E2.S2 |
| FR10 | E2.S2 |
| FR11 | E2.S2 |
| FR12 | E2.S1 |
| FR13 | E3.S1 |
| FR14 | E2.S2 |
