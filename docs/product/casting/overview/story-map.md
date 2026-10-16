---
feature: casting-overview
status: approved
prd: ./prd.md
---

# Casting overview: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | See the whole cast, section by section | FR1, FR8, FR9 |
| E2 | See and rank how much each person is cast | FR2, FR3, FR4, FR5, FR6, FR7 |

## E1: See the whole cast, section by section

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-overview.E1.S1](stories/E1-S1-cast-by-section.md) | The Overview lists every cast member as a card, grouped Scouts, Explorers, Network, Not set, with counts; reports a failed load (walking skeleton, replaces the placeholder) | FR1, FR8, FR9 | (none) | ready |

## E2: See and rank how much each person is cast

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-overview.E2.S1](stories/E2-S1-role-size-pills.md) | Each person shows a pill per role size with a count, or "No parts yet"; counts only roles in the saved running order | FR2, FR5 (marking), FR6, FR7 | E1.S1 | ready |
| [casting-overview.E2.S2](stories/E2-S2-order-by-casting-score.md) | Order each section by casting score (lead 8, support 3, cameo 2, ensemble 1), then total roles, then name; no parts at the bottom | FR3, FR4, FR5 (ordering) | E2.S1 | ready |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E2.S1 |
| FR3 | E2.S2 |
| FR4 | E2.S2 |
| FR5 | E2.S1 (marked "No parts yet"), E2.S2 (at the bottom) |
| FR6 | E2.S1 |
| FR7 | E2.S1 |
| FR8 | E1.S1 (cast), E2.S1 (roles and running order) |
| FR9 | E1.S1 |

## Notes

- **No new API.** The page reads the existing cast, roles and running-order endpoints. Counting and ordering are plain functions (in `roles.ts` or a new `overview.ts`) so they're easy to test.
- **E1.S1 orders each section by last name for now.** E2.S2 replaces that with the casting score.
- **UI consistency (PRD NFR):** cards, pills, headings and the "No parts yet" marker reuse the item page's styles. The phone layout is checked at 320 and 360px for no sideways scrolling, as in the UI tidy-up.
