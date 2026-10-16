---
feature: casting-item-overview
status: approved
prd: ./prd.md
---

# Casting item overview: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | Open an item's casting page | FR1, FR2, FR5, FR6, FR7 |
| E2 | Read an item's roles at a glance | FR3, FR4 |

## E1: Open an item's casting page

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-item-overview.E1.S1](stories/E1-S1-open-item-page.md) | Open an item from the Items list: its name, position, empty state, own URL and a way back | FR1, FR2, FR5, FR7 | casting-items.E1.S1 | done |
| [casting-item-overview.E1.S2](stories/E1-S2-unknown-item.md) | An item that isn't in the running order shows "not found" | FR6 | E1.S1 | done |

## E2: Read an item's roles at a glance

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-item-overview.E2.S1](stories/E2-S1-role-cards.md) | Role cards with a size pill and an uncast marker, ordered by size then name | FR3, FR4 | casting-roles.E1.S1 | done |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E2.S1; cast members' names on the card: casting-roles.E1.S3 and E2.S2 |
| FR4 | E2.S1 |
| FR5 | E1.S1 |
| FR6 | E1.S2 |
| FR7 | E1.S1 |

## Notes

- **E1.S1 also covers** casting-items FR3 (items become links) and the item-page part of casting-menus FR5 (Items shows as current).
- **Position** uses the same numbering as the Running order page: "Item 7 · First half", or "First half · Not in printed programme" (the Running order page's badge wording).
- **E2.S1 follows casting-roles.E1.S1**, which shows new roles as a plain list so adding one is visible. E2.S1 turns that list into ordered cards.
