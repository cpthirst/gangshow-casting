---
feature: running-order
status: approved
prd: ./prd.md
---

# Running order: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | See the running order and its timings | FR1, FR2, FR3, FR12 |
| E2 | Reorder the show, saving each change as a version | FR4, FR5, FR6, FR7, FR8, FR11 |
| E3 | Edit, add and remove items | FR6, FR7, FR9, FR10 |

## E1: See the running order

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [running-order.E1.S1](stories/E1-S1-view-running-order.md) | View the running order (walking skeleton: store → API → page) | FR1, FR2, FR12 | (none) | in-progress |
| [running-order.E1.S2](stories/E1-S2-running-clock.md) | See the running clock | FR3 | E1.S1 | ready |

## E2: Reorder the show

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [running-order.E2.S1](stories/E2-S1-reorder-with-move-buttons.md) | Reorder items with move buttons, saving a new version | FR5, FR6, FR7, FR8, FR11 | E1.S1 | ready |
| [running-order.E2.S2](stories/E2-S2-drag-and-drop.md) | Reorder items by drag and drop | FR4 | E2.S1 | ready |

## E3: Edit the items

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [running-order.E3.S1](stories/E3-S1-edit-item-details.md) | Edit an item's details | FR6, FR7, FR9 | E2.S1 | ready |
| [running-order.E3.S2](stories/E3-S2-add-and-remove-items.md) | Add and remove items | FR6, FR10 | E3.S1 | ready |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E1.S2 |
| FR4 | E2.S2 |
| FR5 | E2.S1 |
| FR6 | E2.S1, E3.S1, E3.S2 |
| FR7 | E2.S1, E3.S1 |
| FR8 | E2.S1 |
| FR9 | E3.S1 |
| FR10 | E3.S2 |
| FR11 | E2.S1 |
| FR12 | E1.S1 |
