---
feature: casting-overview-grid
status: approved
owner: cpthirst
date: 2026-10-18
---
# Overview role counts and casting grid: PRD

## Problem

The Overview shows each person's parts and clashes, but the production team cannot see two things at a glance:

- **How big the show is.** There is no headline count of the lead, support and cameo roles that exist, cast or not, so nobody can tell how many parts the show has to fill.
- **Who is in which item.** Overview is organised by person. To answer "who is in item 7?" or "does anyone have a gap between items 3 and 8?", the team has to open each item or read down every person's timeline. There is no single table of people against items, and nothing that can be taken to a planning meeting or shared on paper.

Users are non-technical volunteers, often working during or after a rehearsal, so the answer needs to be clear at a glance.

## Users

| User | Need |
|---|---|
| Production team member | See the show's role totals, and scan a people-by-items table to spot gaps, heavy loads and back-to-back appearances. |
| Admin | Export the table to Excel for planning meetings, sharing and printing. |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Team can see how many roles the show has without counting | Lead, support and cameo totals are visible on first view of Overview, with no scrolling or tapping | 100% of Overview loads, at 320px width and up |
| Team can see who is in which item in one view | Every cast member has a row and every item a column in the grid | 100% of cast members and items present |
| Team can read role type without relying on colour | Every filled cell shows role size by letter as well as colour | 100% of filled cells |
| Admins can take the grid into Excel | An exported file opens in Microsoft Excel with the same rows, columns and role sizes as the grid | Matches the on-screen grid exactly |

## Non-goals

- Ensemble in the headline counts (ensemble appears in the grid, but is not counted in the headline figures).
- Editing casting from the grid; it is read-only.
- Showing role names, casting notes, group, age band or any other field in the grid or export.
- Import from Excel, or any export format other than Excel (no CSV, PDF or print layout).
- Carrying roles, casting or exports across productions.
- Export for non-admin team members.
- Changing how clashes, casting scores or the per-person Overview work today.

## Functional requirements

- **FR1**: The top of the Overview shows a large, prominent count of the roles in the production for each of lead, support and cameo, whether or not anyone is cast in them. For example: "Lead 12 · Support 18 · Cameo 9".
- **FR2**: The counts update when roles are added or removed and reflect only the current production.
- **FR3**: Ensemble roles are not counted in the headline figures.
- **FR4**: The Overview offers a switch between its existing by-person view and a grid view. The grid is a view of the Overview, not a separate page to navigate to.
- **FR5**: The grid has one row per cast member showing first name, last name and section, followed by one column per show item in running order.
- **FR6**: Each cell shows one coloured dot for the person's most impactful role in that item (lead over support over cameo over ensemble), using the same colour as that role's size elsewhere in the app. A person with several roles in one item still gets a single dot. Ensemble parts get a dot too, in the ensemble colour with the letter E.
- **FR7**: Each dot also carries a letter (L, S, C or E for ensemble) so role size is clear without colour.
- **FR8**: A cell with no casting in that item is visibly empty.
- **FR9**: The grid has a legend explaining colour and letter for each role size.
- **FR10**: Column headers identify each item (title and its running-order position), and the first columns (names) stay visible while scrolling sideways through items.
- **FR11**: Rows are grouped or ordered by section, consistent with the existing Overview.
- **FR12**: Admins see an "Export to Excel" action on the grid. Other signed-in users do not see it, and the server refuses it for them.
- **FR13**: The exported Excel file contains exactly what the grid shows: first name, last name, section, then one column per item in running order, with each filled cell holding the role-size letter and a matching colour fill.
- **FR14**: The exported file contains no other cast data (no group, age band, notes or role names) and is named for the production and date.

## Non-functional requirements

- **Security and safeguarding**: The grid and export contain children's names, so they are for the production team only and must never be publicly reachable. Export is admin-only and enforced on the server, not just hidden in the page (ADR 0018). Export contains only first name, last name, section and role size (ADR 0010). It creates a copy outside the app's access control, so an ADR is needed recording who may export and why. Tests and fixtures use made-up names only.
- **Accessibility**: WCAG 2.2 AA. Role size is never conveyed by colour alone (FR7). The grid is a real table with column and row headers so screen readers announce person and item. Dot colours meet 3:1 non-text contrast against the cell background. The counts are readable text, not an image.
- **Performance**: Counts and grid render within 1 second for a show of up to 100 cast members and 40 items on a mid-range phone. The export downloads within 5 seconds for the same size.
- **Responsive**: No page-level sideways scrolling at 320px and 360px (ADR 0011). Only the grid scrolls sideways within its own area.

## Constraints and assumptions

- Role sizes and their colours already exist in the app (lead, support, cameo, ensemble); the grid reuses them rather than defining new ones.
- Casting is per item, and each production is self-contained.
- Hosted behind sign-in, with admin-only routes available (hosting E2/E4).
- Assumes the production team reads Excel; the export is a convenience copy, not a source of truth.
- The existing "Overview" PRD (`casting-overview`) and rules PRD (clash icons) stay in force; this feature adds to them.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Exported file with children's names is shared outside the team | M | H | Admin-only, minimum fields, file name carries no extra detail, ADR records the decision, and the admin button wording reminds users the file is team-only |
| A wide grid (many items) is hard to read on a phone | H | M | Sticky name columns, a compact cell, browser layout test at 320/360px |
| Colour dots unreadable to colour-blind users | M | M | Letter on every dot and a legend (FR7, FR9) |
| Excel generation adds a dependency or hosting cost | M | M | Decide approach in an ADR before building (see open questions) |

## Decisions

- **Several roles in one item**: the cell shows only the most impactful role (lead, then support, then cameo, then ensemble). Decided by cpthirst.
- **Ensemble in the grid**: ensemble parts appear as a coloured dot with the letter E, but stay out of the headline counts and the export file gets the letter E too. Decided by cpthirst.
- **Open roles in the counts**: not shown. The headline counts are totals only. Decided by cpthirst.
- **Export built by the server**: FR12 needs the server to refuse non-admins, which a file built in the browser from data already loaded cannot do. An admin-only route returns the file (ADR 0018). The ADR in E3.S1 records this and picks the spreadsheet library. Decided by Claude at cpthirst's request.
- **Export is admin-only**: confirmed by cpthirst.
- **Slug and folder**: `casting-overview-grid` under `casting/overview/grid/`. Confirmed by cpthirst.
