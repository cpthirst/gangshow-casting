---
feature: app-shell
status: approved
prd: ./prd.md
---

# App shell: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | A branded, navigable shell for the casting app | FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8 |

## E1: Branded, navigable shell

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [app-shell.E1.S1](stories/E1-S1-navigate-between-pages.md) | Navigate between placeholder pages in a branded shell | FR1, FR2, FR3, FR4, FR5, FR7, FR8 | (none) | ready |
| [app-shell.E1.S2](stories/E1-S2-use-menu-on-phone.md) | Use the menu on a phone | FR6 | E1.S1 | ready |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E1.S1 |
| FR4 | E1.S1 |
| FR5 | E1.S1 |
| FR6 | E1.S2 |
| FR7 | E1.S1 |
| FR8 | E1.S1 |
