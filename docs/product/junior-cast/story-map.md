---
feature: junior-cast
status: approved
prd: ./prd.md
---

# Junior cast: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | Record Beavers and Cubs in the cast list, and see the Junior or Senior cast on its own | FR1, FR7, FR8, FR9, FR11 |
| E2 | Mark each item's gang, cast its roles only from that gang, and keep it that way when an item's gang or a member's section changes | FR2–FR6, FR9–FR12 |

## E1: Junior sections in the cast list

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [junior-cast.E1.S1](stories/E1-S1-beavers-and-cubs-sections.md) | A cast member's section can be Beavers or Cubs. The Cast page's form and section filter offer them, and the Casting overview and its Excel and Word exports group them in their own sections. ADR 0010 is amended for the younger cast | FR1, FR7, FR8, FR9 | (none) | done |
| [junior-cast.E1.S2](stories/E1-S2-filter-cast-junior-or-senior.md) | The Cast page filters the cast list to the Junior cast (Beavers, Cubs) or the Senior cast (Scouts, Explorers, Network, no section). Help describes the two casts | FR1, FR7, FR9, FR11 | E1.S1 | ready |

## E2: Items for the Junior cast

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [junior-cast.E2.S1](stories/E2-S1-mark-an-items-gang.md) | In the running order, an item's Gang sets it for the Senior gang, the Junior gang or both. Senior unless marked, including every existing item. Saved with the version, and cut with the item | FR2, FR3, FR9, FR10 | (none) | ready |
| [junior-cast.E2.S2](stories/E2-S2-cast-search-follows-the-item.md) | When casting any role, the cast member search offers only the item's gang, and the server refuses anyone else. Help describes it | FR4, FR11 | E1.S2, E2.S1 | ready |
| [junior-cast.E2.S3](stories/E2-S3-gang-change-removes-mismatched-cast.md) | Saving a change to an item's gang first lists who will be removed from which roles, and asks to confirm. The server then removes them, and Props carriers and the Mic plot follow as after any casting change. Help describes it | FR5, FR6, FR11 | E2.S2 | ready |
| [junior-cast.E2.S4](stories/E2-S4-section-change-removes-from-mismatched-items.md) | Saving a change to a cast member's section first lists which roles in which items they'll leave, and asks to confirm. The server then removes them from items for the other gang, using the same removal as E2.S3. Props carriers and the Mic plot follow. Help describes it | FR6, FR11, FR12 | E2.S3 | ready |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1, E1.S2 |
| FR2 | E2.S1 |
| FR3 | E2.S1 |
| FR4 | E2.S2 |
| FR5 | E2.S3 |
| FR6 | E2.S3, E2.S4 |
| FR7 | E1.S1, E1.S2 |
| FR8 | E1.S1 |
| FR9 | E1.S1, E1.S2, E2.S1 |
| FR10 | E2.S1 |
| FR11 | E1.S2, E2.S2, E2.S3, E2.S4 |
| FR12 | E2.S4 |
