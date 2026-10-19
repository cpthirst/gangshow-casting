---
feature: casting-overview-by-item
status: approved
owner: cpthirst
date: 2026-10-19
---

# Casting overview by item: PRD

## Problem

The Overview shows the cast by person and as a grid. Nothing shows the whole show **item by item**, in running order, with every part and who plays it. To brief item leaders or check an item's casting, the team opens each item's page one at a time. There is also no printable record to hand out. Item leaders want a document of the show's casting, and each young person needs a sheet showing which items they're in, so they can bring costume from home. Today the team copies this out by hand, and the copies drift from the app.

## Users

| User | Need |
|---|---|
| Production team (every role) | See every item's parts and cast in show order on one screen |
| Item leaders and creative team | A Word document of the show's casting, laid out like the screen, to read or print |
| Cast members (Scouts, Explorers, Network), through the team | A printed sheet of their own items, with space to note costume from home |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| The whole show's casting is readable in one place | Item pages opened to see every item's roles and cast | 0 (one view shows them all) |
| The document matches the screen | Items, roles or cast names that differ between the By item view and the Item Overview document | 0 |
| Every cast member gets an accurate sheet | Cast members without a page; ticks that don't match their roles in printed items | 0 |
| Anyone on the team can make the documents | Team roles that can't use either Word export | 0 |

## Non-goals

- Editing roles or casting from the By item view. That stays on each item's page.
- Filling in "Costume from home". It's left blank for the cast member or leader to write in.
- Showing role names, clash warnings, timings or stage on the casting sheets.
- Emailing, sharing or storing the documents anywhere. The app only downloads them.
- Other formats (PDF, Excel) for these two documents.
- Changing the existing Excel export, or what the By person view shows.

## Functional requirements

### By item view

- **FR1**: The Overview's view switch must gain a third choice, **By item**, beside "By person" and "Grid".
- **FR2**: The By item view must list every item of the latest saved running order in show order, split into the first and second half under each half's name. Each item shows its title and its programme number if it's in the printed programme.
- **FR3**: Items left out of the printed programme must still appear, marked the way the grid marks them (red italics), with no number.
- **FR4**: Under each item, its roles must be listed with three columns: **Role name**, **Role type** (its role size: lead, support, cameo or ensemble) and **Cast** (the cast member's first name and surname; for an ensemble, all of them). Roles are in the same order as on the item's page: by size, then role name ignoring case.
- **FR5**: A role with nobody in it must say "Uncast" in the Cast column. An item with no roles must say it has no roles yet.
- **FR6**: The view must be the same for every team role (Admin, Casting Team Member, Read-Only Team Member) and offer no editing.

### Word exports

- **FR7**: Two Word export buttons, shaped like "Export to Excel" and placed where it sits on the grid (beside the view switch), but **blue**: **Export Item Overview** on the By item view only, and **Export Casting Sheets** on the By person view only. Every team role can use both.
- **FR8**: **Export Item Overview** must download a Word document that reproduces the By item view: Heading 1 is the production's title, Heading 2 each half's name, Heading 3 each item (with its number, if printed). Under each item is a table of Role name, Role type and Cast. Unprinted items and uncast roles appear as they do on screen (FR3, FR5).
- **FR9**: **Export Casting Sheets** must download one Word document with **one page per cast member**, for every member of the production's cast, including anyone not yet cast in anything.
- **FR10**: Pages must be ordered by section (Scouts, Explorers, Network, then anyone with no section set), then by surname, then first name.
- **FR11**: Each page must have a heading of the production's title, then the cast member's first name, surname, section and Scout group or Explorer unit.
- **FR12**: Each page must have a three-column table: **Item Name**, **Am I cast** and **Costume from home**. It has one row per item in the printed programme, in show order with its programme number, and a break between the halves. Items left out of the printed programme are left out.
- **FR13**: "Am I cast" must show a tick when the cast member holds any role in that item, and be empty otherwise. "Costume from home" is always empty, with room to write in by hand.
- **FR14**: While an export is being made, its button must show it's busy and can't be pressed twice. When it finishes, screen readers are told. If it fails, the user is told and can try again, as with the Excel export.
- **FR15**: Both documents must reflect the latest saved running order, roles and cast at the moment of export, and have file names that say what they are and which production they're for.

## Non-functional requirements

- **Security and safeguarding**: the documents copy young people's names, sections and groups outside the app's access control, as the Excel export already does (ADR 0021). They hold only the fields the screen shows: no age band, Singing or Acting notes, or anything else about the cast. Only signed-in team members can make them. Each casting sheet shows one person's name and items, so a page handed to a young person shows nobody else's details. Tests and fixtures use made-up names. The new document-making dependency needs a security review and an ADR.
- **Accessibility**: WCAG 2.2 AA in the app. The By item view uses real headings and tables (or lists) so screen readers can move by item. Role type is text, not only colour. The blue buttons meet contrast and have visible focus. The view works at 320px and 360px without sideways scrolling. The Word documents use true heading styles and table header rows, so they're navigable in Word's navigation pane and by screen readers.
- **Performance**: for a show of about 40 items, 400 roles and 150 cast members, the By item view appears in under 1 second once the Overview's data has loaded, and each export downloads in under 5 seconds.

## Constraints and assumptions

- The Word documents are made with the `docx` library (github.com/dolanmiu/docx), as the user asked. Where they're built (browser or server) is decided in an ADR. That ADR also covers the new dependency and how it relates to ADRs 0019 and 0021.
- "Role type" is the existing **role size**. Names, item numbers and halves are worked out the same way as on the rest of the Overview and the Running order page.
- The production title is the running order's title.
- Fits the existing team roles: nothing here changes stored data, so Read-Only Team Members can use everything.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Printed sheets get lost or left at the venue | M | M | Each page holds only one person's name and items, nothing else about them |
| The Word document looks different in Word, LibreOffice and Google Docs | M | L | Use built-in heading styles and plain tables; check in Word and one other app |
| A new dependency adds weight or risk | M | M | ADR and security review; the existing no-third-party test still holds |
| An item's roles don't fit on the phone screen | M | L | Covered by the 320px/360px layout tests |

## Open questions

- Should the casting sheets also show the show's dates or venue? Not stored today, so assumed no. Owner: cpthirst.
