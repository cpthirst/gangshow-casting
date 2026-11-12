---
feature: production-costume-sheets
status: approved
owner: Nick Hirst
date: 2026-11-12
---

# Production costume sheets: PRD

## Problem

The Wardrobe team knows, for every cast member in every item, what Wardrobe provides and what the cast member brings from home. None of that is in iCUE. An item's Wardrobe page holds files and one block of notes about the item (production-sfx-wardrobe FR2, FR8), with nowhere to say that Alex, as Captain Hook, gets a red coat from Wardrobe and brings black shoes. So the team keeps it in a spreadsheet or on paper, retypes it when casting changes, and writes each cast member's costume sheet by hand before fittings and the show.

The casting sheet (casting-overview-by-item FR9–FR13) has a blank "Costume from home" column to write in, which is the same thing done by hand, per person, every time it is printed.

## Users

| User | Need |
|---|---|
| Wardrobe team, with Wardrobe permission | Record once, per item and per person, what Wardrobe provides and what they bring, and hand every cast member a sheet listing it |
| Director, with Director permission | Change the costumes, as every Production department's pages (production-scenery FR2) |
| Cast members and their parents (on paper) | A sheet that says, item by item, what they are given and what to bring |
| Everyone else signed in (Casting, Stage, Tech, Read-Only Team Members) | See what each person wears in an item, and save the costume sheets, without being able to change them |
| Admin | Change the costumes themselves |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Costume data is entered once | Places the team records what a cast member wears in an item | 1 (the item's Wardrobe page) |
| A costume sheet takes no retyping | Steps from the Production Overview to a Word document with every cast member's sheet | 1 (one button) |
| A recast is free | Costume rows the team edits after a role is recast, to get the new person's row | 0: the rows follow the casting |
| Editing is quick at a rehearsal | Time to change one person's three fields and save, starting on the item's Wardrobe page | Under 20 seconds |
| Access matches what someone does | Changes the API accepts outside an account's permissions, covered by tests for the new change route and every permission | 0 |
| The sheets stay private to each person | Details of anyone else on a cast member's costume sheet | 0 (as the casting sheet, ADR 0022) |
| Nothing else moves | Scenery, SFX, Props and Mic plot behaviours that change in the release, beyond the "Files" heading | 0 |

## Non-goals

- **Sizes and measurements.** The fields describe garments and who provides them, never a cast member's size or measurements (decided 2026-11-12; ADR 0010 stands).
- **Photos**, fitting photos included (production-sfx-wardrobe FR4 stands).
- **A per-role costume** that applies to everyone in an ensemble, or role defaults with per-person overrides. A row is one cast member in one role (decided 2026-11-12).
- **A costume list by item** (every item, then everyone in it) as a Word export. The Props list covers that shape; it can be its own feature.
- **Costumes on the Production Overview**: no count column, and the rows don't appear under an item's row as its notes do.
- **Costumes on the Casting pages**, the Casting grid or the casting sheets.
- **Costume stock**, a wardrobe inventory, or which garment is in which box.
- **Tracking returns**, fittings, or who has been handed a sheet.
- **New permissions.** Wardrobe and Director already exist.

## Functional requirements

### Who can change them
- **FR1**: Admins and anyone with **Wardrobe** or **Director** can change an item's costumes, the same people who change its Wardrobe files and notes (production-sfx-wardrobe FR1). Everyone else sees the costumes with nothing to change them, and the page's existing line saying who can change it. The API refuses every change outside these permissions, however the request is made (production-props FR4).

### An item's Wardrobe page
- **FR2**: An item's Wardrobe page has three sections, in this order, each with a heading: **Files** (its files and upload, as today), **Costumes** (FR3–FR8) and **Wardrobe notes** (as today). The Scenery and SFX pages gain the same **Files** heading over their files, so that the three file pages stay alike.
- **FR3**: **Costumes** has one row for each cast member in each of the item's roles, ensembles included, so a 30-person ensemble has 30 rows. Rows follow the roles in the item's role order and, within a role, its cast members in the order the casting item page shows them. Each row shows the role's name and the cast member's name (first name and surname), as a prop card shows its roles and carriers (production-props FR18). A role with nobody cast in it shows one row saying so, with nothing to edit. An item with no roles says that nobody is cast in it yet.
- **FR4**: Each row shows three free-text fields, each up to 500 characters: **From Wardrobe**, **From Cast Member** and **Notes**. An empty field shows nothing, so a row nobody has filled in is just the role and the name.
- **FR5**: For those who can change costumes, each row has a pencil button, like a prop card's (production-props FR19), that turns the row into a form holding all three fields with **Save** and **Cancel**. One Save stores all three fields together; there is no save per field. Cancel, or Escape, puts the row back unchanged. While a save is on its way the form shows it, and when it lands the row shows the new text and screen readers are told. Only one row is in edit at a time.
- **FR6**: The form says, in one line beside the fields, that sizes and measurements don't go here, as the upload area says that photos don't (production-sfx-wardrobe FR4).
- **FR7**: A save is refused, showing the row's current text, if someone else saved that row since the page loaded, as item notes and roles are (production-props FR20). The API refuses a field over 500 characters, a role not in the item, or a cast member not in that role.
- **FR8**: Costumes follow the casting. A row belongs to one cast member in one role in one item in the current production. Recasting a role shows the new cast member's row, empty until filled in; the previous cast member's text is no longer shown. Removing a role from an item, or deleting a cast member from the cast (ADR 0010), removes their rows. When a saved running order drops the item, its costumes go in the same clean-up as its files and notes (production-scenery FR12, FR13).

### Costume sheets
- **FR9**: The Production Overview has a **Generate Costume Sheets** button beside Generate Props List and Generate Mic Plot, for every role, Read-Only Team Members included. It follows the existing Word exports' conventions (production-props FR22): built in the browser from what the app shows (ADR 0022), a file named for the production and the date, loading only when used, busy while it runs, announced when done, and able to be tried again if it fails (casting-overview-by-item FR14).
- **FR10**: The document is laid out as the casting sheets are (casting-overview-by-item FR9–FR12): one page per cast member, for every member of the production's cast, ordered by section, then surname, then first name, each headed with the production's title, then the cast member's name, section and Scout group or Explorer unit, and nobody else's details.
- **FR11**: Each page has a five-column table: **#**, **Item Name**, **Role**, **From Wardrobe** and **From Cast Member**, with one row per item in show order, a break between the halves, the programme number in the # column, and an item left out of the printed programme shown with no number and its name in the grid's red italics. Where the cast member holds a role in the item, the row shows the role's name and that row's From Wardrobe and From Cast Member text; where they hold two roles in one item, each role has its own row. Where they aren't in the item, Role and both costume columns are empty. Notes never appear on a sheet.

### The casting sheets
- **FR12**: The casting sheets lose their **Costume from home** column. Each page's table becomes **#**, **Item Name** and **Cast**, Item Name taking the width the dropped column had, and is otherwise unchanged.

### Help and Usage
- **FR13**: The Welcome and Help pages describe the Costumes section (the three fields, who can change them, that they follow the casting, and that sizes, measurements and photos stay out), the Generate Costume Sheets button, and the casting sheets' changed columns. The Wardrobe permission's line says it changes an item's costumes as well as its files and notes.
- **FR14**: The Usage page records each Generate Costume Sheets, as it records the other exports (usage-tracking). Visits to the Wardrobe page are already recorded; a costume save is not.

## Non-functional requirements

- **Security and safeguarding**:
  - Every read and change of costumes needs a signed-in account; the API enforces FR1, the field limits and FR7 itself, and costumes are reachable only through routes scoped to the production, item, role and cast member.
  - Costume text is shown as text, never rendered as markup, on the page and in the document.
  - The fields hold nothing about a person beyond what they wear in a show item. Sizes, measurements and anything else ADR 0010 keeps out stay out, held by FR6 and Help rather than checks, as the "no photos" rule is. No new kind of personal data, so no ADR amendment.
  - A costume sheet carries one cast member's name, section and group and nothing about anyone else, as the casting sheet does (ADR 0022). Both documents hold under-18s' names and are for the production team to print and hand out, which Help says.
- **Accessibility**: WCAG 2.2 AA, as the Props page: each pencil has an accessible name saying whose row it edits ("Edit Alex Morgan as Captain Hook"); each field is labelled; a save or refusal is announced; keyboard reaches every row and field and Escape cancels; targets are at least 24 by 24 CSS pixels; the page works at 320px and 360px with no sideways scrolling, long names and long text included.
- **Performance**: an item with about 60 rows shows them within a second of the page's other data; a save lands and the row updates within a second on a normal connection; the costume sheets for a cast of about 150 generate in under 10 seconds in the browser, as the casting sheets do.

## Constraints and assumptions

- Builds on production-sfx-wardrobe (the Wardrobe page, its permission and files), production-props (the card with a pencil that becomes a form, and per-item data that follows the casting) and the Word exports (ADR 0022, the casting sheets' layout). The costume rows, the save route and the export are expected to join those families, not copy them: the costumes become one more kind of per-item data in the shared clean-up, the pencil-to-form row shares what the prop card has, and the costume sheets share the casting sheets' document.
- One Costumes record per cast member per role per item. Where roles are the unit on other pages (props) and people are here, the sheets and the page read from the same records.
- Deploys stay the maintainer's (CLAUDE.md). Cost stays close to £0: a few short text fields per casting.
- **Decided 2026-11-12**: a row per cast member in a role; the export lives on the Production Overview; a sheet lists every item, as the casting sheet does; no sizes or measurements; the feature is `production-costume-sheets`, under `docs/product/production/` as the other Wardrobe work.
- **Assumption**: Notes is for the Wardrobe team's own working ("hem before Tuesday") and never leaves the app; From Wardrobe and From Cast Member are written for the cast member and their parents to read.
- **Assumption**: when a role is renamed its rows keep their text, as a prop keeps its renamed roles (production-props FR18).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sizes or measurements are typed into a field | M | M | The line on the form (FR6) and Help; anyone who can change costumes can clear it; the text is never public |
| A recast quietly hides text someone spent time on | M | L | FR8 says it's by design and Help says so; the previous cast member's text comes back if they are recast into the role before the item is cut |
| A large ensemble makes the Wardrobe page long and slow to edit | M | M | One row in edit at a time, the rest plain text; the performance target above; the row order matches the casting page so a name is found the same way |
| Costume rows and the sheets disagree | L | M | Both read the same records; the document is built from what the page shows (ADR 0022) and tested against it |
| The casting sheets' column change surprises the team | L | L | Release notes and Help describe it; the costume sheets carry what "Costume from home" was for |
| Costume rows survive an item being cut | L | M | They join the shared clean-up (FR8), tested with the other kinds |

## Open questions

None open.
