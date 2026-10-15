---
feature: casting-items
status: approved
prd: ./prd.md
---

# Casting items: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | See the show's items for casting | FR1, FR3, FR4, FR5, FR6, FR7 |
| E2 | See each item's casting progress | FR2 |

## E1: See the show's items for casting

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-items.E1.S1](stories/E1-S1-list-items.md) | List the latest saved running order's items in halves, with numbers and titles and no management controls (walking skeleton) | FR1, FR4, FR5, FR7 | casting-menus.E1.S1 | done |
| [casting-items.E1.S2](stories/E1-S2-no-running-order.md) | Explain when there's no saved running order, with a link to the Running order page | FR6 | E1.S1 | ready |

## E2: See each item's casting progress

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-items.E2.S1](stories/E2-S1-role-counts.md) | Show each item's total roles and roles cast | FR2 | E1.S1, casting-roles.E1.S3 | ready |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E2.S1 |
| FR3 | casting-item-overview.E1.S1 (each item becomes a link when its page exists) |
| FR4 | E1.S1 |
| FR5 | E1.S1 |
| FR6 | E1.S2 |
| FR7 | E1.S1 |

## Notes

- **No new API for E1.** The list reads the existing running-order endpoint, the latest saved version. Unsaved changes live only in the Running order page's browser state, so they're never shown.
- **Numbers** are worked out by the same code as the Running order page (printed items only), never duplicated.
- **Counts arrive last** (E2.S1). They need roles to exist (casting-roles.E1.S1) and casting someone to be possible (casting-roles.E1.S3).
