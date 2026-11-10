---
feature: department-switch
status: approved
prd: ./prd.md
---

# Department switch: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | From one Production department's page for an item, open another department's page for the same item in one tap | FR1–FR12 |

## E1: Switch department on the same item

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [department-switch.E1.S1](stories/E1-S1-switch-department-on-an-item.md) | The shared Production item frame shows a switch of every Production department, in the Overview's order, with the current one marked. Choosing one opens its page for the same item. Icons only at phone width, names as tooltips. Not on the Casting item page, nor in the not-found and error states. Help for the item pages describes it, and the browser layout tests check it stays on one row at 320px and 360px | FR1–FR12 | (none) | done |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E1.S1 |
| FR4 | E1.S1 |
| FR5 | E1.S1 |
| FR6 | E1.S1 |
| FR7 | E1.S1 |
| FR8 | E1.S1 |
| FR9 | E1.S1 |
| FR10 | E1.S1 |
| FR11 | E1.S1 |
| FR12 | E1.S1 |
