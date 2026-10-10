---
feature: <feature-slug>
status: draft
prd: ./prd.md
---

# <Feature name>: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | <user-visible capability> | FR1, FR2 |
| E2 | <…> | FR3 |

## E1: <epic name>

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [<feature>.E1.S1](stories/E1-S1-<slug>.md) | <walking skeleton: thinnest end-to-end path> | FR1 | (none) | draft |
| [<feature>.E1.S2](stories/E1-S2-<slug>.md) | <…> | FR2 | E1.S1 | draft |

## E2: <epic name>

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [<feature>.E2.S1](stories/E2-S1-<slug>.md) | <…> | FR3 | E1.S1 | draft |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S2 |
| FR3 | E2.S1 |
