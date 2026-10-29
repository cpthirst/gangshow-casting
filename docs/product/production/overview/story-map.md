---
feature: production-overview
status: approved
prd: ./prd.md
---

# Production overview: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | The Costume department and permission are called Wardrobe everywhere | FR1, FR2 |
| E2 | One Overview under Production, with a button and a count per department page on every item | FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR13, FR14 |
| E3 | Welcome, Help and Usage follow the new page | FR12, FR13 |

## E1: Wardrobe

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-overview.E1.S1](stories/E1-S1-costume-becomes-wardrobe.md) | Costume becomes Wardrobe in the permission, its sign-in group, the Accounts page, the "Local role" switch, refusals, the Costume page (now Wardrobe) and Help. `costume` grants nothing. Includes the ADR amending ADR 0026 | FR1, FR2 | (none) | done |

## E2: The Overview

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-overview.E2.S1](stories/E2-S1-overview-with-props.md) | Walking skeleton: Production's menu has one page, Overview, replacing Stage, Tech and Wardrobe. It lists the running order by half: #, title with "Not in printed programme", a square Props button (edit or view, by permission) and the props count, with props notes under the row. Also the no-running-order message and Generate Props List. The props item page links back to the Overview. Old Stage, Tech, Costume and Production addresses open the Overview. Usage records Overview visits | FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR11, FR13 | E1.S1 | done |
| [production-overview.E2.S2](stories/E2-S2-department-buttons-and-item-pages.md) | Each row gains Scenery, SFX, Mic plot and Wardrobe buttons, in order around Props, each with its icon and an accessible name. Each opens that department's page for the item, which says "Coming soon" and has a link back to the Overview, Previous and Next, and a not-found message for an unknown item | FR4, FR5, FR10 | E2.S1 | done |
| [production-overview.E2.S3](stories/E2-S3-department-counts.md) | After the title, a count column per department in button order. Scenery shows each item's file count from storage ("9" over "files"), Props its props the same way, and SFX, Mic plot and Wardrobe a dash until they're built. One API route counts the production's scenery files | FR4, FR14 | E2.S2, production-scenery.E2.S1 | ready |

## E3: Finding your way

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-overview.E3.S1](stories/E3-S1-welcome-and-help.md) | Welcome and Help describe the Overview, what each button opens and its icon, Generate Props List, and which permission changes each department's pages | FR12 | E2.S2 | done |
| [production-overview.E3.S2](stories/E3-S2-purge-old-department-usage.md) | The repo's usage purge command and its code are removed; the old pages' visits are purged once by hand after the deploy | FR13 | E2.S1 | done |

## Order

E1.S1 → E2.S1 → E2.S2 → E3.S1 → E3.S2 → E2.S3

- E1.S1 goes first, as asked, and is small. It renames the Costume page to Wardrobe, so the app never says "Costume" again. The page goes in E2.S1.
- E2.S1 is mostly a move: today's Props view becomes the Overview, so there's never a release without the props list.
- E2.S1 keeps Help in step with the menu, so Help never names a page that's gone. E3.S1 then rewrites it properly once every button exists.
- E3.S2: the maintainer chose a one-off purge after the deploy (2026-10-27), so the story removes the repo's purge command instead of extending it.

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E2.S1 |
| FR4 | E2.S1, E2.S2, E2.S3 |
| FR5 | E2.S1, E2.S2 |
| FR6 | E2.S1 |
| FR7 | E2.S1 |
| FR8 | E2.S1 |
| FR9 | E2.S1 |
| FR10 | E2.S2 |
| FR11 | E2.S1 |
| FR12 | E3.S1 |
| FR13 | E2.S1, E3.S2 |
| FR14 | E2.S3 |
