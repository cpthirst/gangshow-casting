---
feature: casting-menus
status: approved
prd: ./prd.md
---

# Casting menus: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | Find the casting pages in the menu | FR1, FR2, FR3, FR4, FR5, FR6 |

## E1: Find the casting pages in the menu

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-menus.E1.S1](stories/E1-S1-casting-menu-group.md) | "Casting grid" becomes a Casting group with Overview and Items (placeholders), on desktop and the mobile menu | FR1, FR2, FR3, FR5, FR6 | (none) | done |
| [casting-menus.E1.S2](stories/E1-S2-old-casting-grid-link.md) | Old "Casting grid" links go to Overview | FR4 | E1.S1 | done |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E1.S1 |
| FR4 | E1.S2 |
| FR5 | E1.S1; Items shown as current on an item's page: casting-item-overview.E1.S1 |
| FR6 | E1.S1 |

## Notes

- **Items starts as a placeholder** here. casting-items.E1.S1 replaces it with the real list.
- **Adding a page stays cheap** (app-shell): the group should be one entry in the menu list, with its sub-pages inside it.
