---
feature: casting-overview-grid
status: approved
prd: ./prd.md
---

# Overview role counts and casting grid: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | See how many roles the show has | FR1, FR2, FR3 |
| E2 | See who is in which item in one table | FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11 |
| E3 | The team takes the grid into Excel | FR12, FR13, FR14 |

## E1: See how many roles the show has

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-overview-grid.E1.S1](stories/E1-S1-role-counts.md) | The top of Overview shows large Lead, Support and Cameo totals for the current production, cast or not, excluding ensemble, and they change as roles are added or removed (walking skeleton) | FR1, FR2, FR3 | (none) | done |

## E2: See who is in which item in one table

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-overview-grid.E2.S1](stories/E2-S1-grid-view.md) | A switch on Overview changes between the by-person view and a grid: a row per cast member (first name, last name, section; ordered by section) and a column per item in running order, with one coloured dot and letter for the person's most impactful role in that item (ensemble included, with E) and empty cells left visibly empty | FR4, FR5, FR6, FR7, FR8, FR11 | E1.S1 | done |
| [casting-overview-grid.E2.S2](stories/E2-S2-grid-headers-and-scrolling.md) | Item columns are headed by title and running-order position, name columns stay in view while the grid scrolls sideways inside its own area, and the page itself never scrolls sideways at 320px or 360px | FR10 | E2.S1 | done |
| [casting-overview-grid.E2.S3](stories/E2-S3-grid-legend.md) | A legend explains the colour and letter for Lead, Support, Cameo and Ensemble | FR9 | E2.S1 | done |

## E3: The team takes the grid into Excel

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-overview-grid.E3.S1](stories/E3-S1-export-decision.md) | Record in an ADR that the server builds the Excel file behind an admin-only route, which library it uses, and who may export and why (documentation story) | (none: NFR) | (none) | done |
| [casting-overview-grid.E3.S2](stories/E3-S2-admin-export.md) | An admin sees "Export to Excel" on the grid and downloads a file named for the production and date, with first name, last name, section and a role-size letter per filled cell; other users see no button and the server refuses them | FR12, FR13, FR14 | E2.S1, E3.S1 | done |
| [casting-overview-grid.E3.S3](stories/E3-S3-export-colours.md) | Each filled cell in the exported file also carries the colour fill matching the grid | FR13 | E3.S2 | done |
| [casting-overview-grid.E3.S4](stories/E3-S4-export-for-everyone.md) | Every team role can export, from an "Export to Excel" button with an icon beside the By person / Grid switch (ADR 0021) | FR12 | E3.S2, team-roles.E5.S2 | done |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E1.S1 |
| FR4 | E2.S1 |
| FR5 | E2.S1 |
| FR6 | E2.S1 |
| FR7 | E2.S1 |
| FR8 | E2.S1 |
| FR9 | E2.S3 |
| FR10 | E2.S2 |
| FR11 | E2.S1 |
| FR12 | E3.S2, E3.S4 |
| FR13 | E3.S2, E3.S3 |
| FR14 | E3.S2 |
