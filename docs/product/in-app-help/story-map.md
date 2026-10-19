---
feature: in-app-help
status: approved
prd: ./prd.md
---

# In-app help: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | A Welcome page to land on, and a help button that opens a page's help where you are | FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR11 |
| E2 | Help for every other page in scope | FR3, FR4, FR5, FR6, FR7, FR9, FR10 |

## E1: Welcome page and help button

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [in-app-help.E1.S1](stories/E1-S1-welcome-page.md) | Walking skeleton: signing in lands on a "Welcome" page, first in the menu, with a short introduction and the Running order's help (a line per action, with its real icon and an access label, linking to the page). The Running order keeps working from its own address | FR1, FR2, FR3, FR4, FR5, FR11 | (none) | done |
| [in-app-help.E1.S2](stories/E1-S2-help-button.md) | A help button at the top right of the Running order opens its help (the same text as on Welcome) in an accessible dialog, which closes with its close button, Escape or a click outside, without losing unsaved changes | FR6, FR7, FR8, FR9 | E1.S1 | done |

## E2: Help for each page

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [in-app-help.E2.S1](stories/E2-S1-cast-help.md) | The Cast page's help, on Welcome and behind its help button | FR3, FR4, FR5, FR6, FR7, FR9 | E1.S2 | ready |
| [in-app-help.E2.S2](stories/E2-S2-casting-overview-help.md) | The Casting overview's help, on Welcome and behind its help button | FR3, FR4, FR5, FR6, FR7, FR9 | E1.S2 | ready |
| [in-app-help.E2.S3](stories/E2-S3-items-and-item-help.md) | The Casting items list's and single item page's help, on Welcome and behind each page's help button; the item's help says how to reach it (Casting → Items) | FR3, FR4, FR5, FR6, FR7, FR9, FR10 | E1.S2 | ready |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E1.S1, E2.S1, E2.S2, E2.S3 |
| FR4 | E1.S1, E2.S1, E2.S2, E2.S3 |
| FR5 | E1.S1, E2.S1, E2.S2, E2.S3 |
| FR6 | E1.S2, E2.S1, E2.S2, E2.S3 |
| FR7 | E1.S2, E2.S1, E2.S2, E2.S3 |
| FR8 | E1.S2 |
| FR9 | E1.S2, E2.S1, E2.S2, E2.S3 |
| FR10 | E2.S3 |
| FR11 | E1.S1 |
