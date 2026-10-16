---
feature: casting-rules
status: approved
prd: ./prd.md
---

# Casting rules: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | Try the app on a demo show | NFR (demo data) |
| E2 | See clashes on an item's page | FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR10, FR11, FR12, FR13 |
| E3 | See clashes from the summary pages | FR8, FR9, FR10, FR13 |

## E1: Try the app on a demo show

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-rules.E1.S1](stories/E1-S1-demo-show.md) | `pnpm demo` serves the app on a fresh copy of a committed, made-up full show, set up with every kind of clash, on its own ports beside `pnpm dev`, labelled "Demo data" on every page | NFR (demo data) | (none) | done |

## E2: See clashes on an item's page

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-rules.E2.S1](stories/E2-S1-back-to-back-errors.md) | Back-to-back errors (walking skeleton): named parts in two items in a row get an Error icon by the person's name on both item pages, described on hover and focus, written out on phones | FR1, FR2, FR7, FR10, FR11 (error), FR12, FR13 | (none) | done |
| [casting-rules.E2.S2](stories/E2-S2-back-to-back-warnings.md) | Back-to-back warnings when either part is ensemble; one icon at the worst severity, with every clash described | FR3, FR7 (worst and all), FR11 (warning) | E2.S1 | done |
| [casting-rules.E2.S3](stories/E2-S3-timing-and-quick-changes.md) | Timing warnings (gap under 5 minutes) and quick-change info (5 to under 8), counting the items and interval between, comparing only next appearances | FR4, FR5, FR6, FR11 (info) | E2.S2 | done |

## E3: See clashes from the summary pages

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-rules.E3.S1](stories/E3-S1-items-list-icons.md) | The Items list shows an icon on each item with a clash, at its worst severity, saying how many of each and who | FR8, FR10, FR13 | E2.S3 | ready |
| [casting-rules.E3.S2](stories/E3-S2-overview-icons.md) | The Overview shows an icon on each person with a clash anywhere, at their worst severity, listing each clash and its items | FR9, FR10, FR13 | E2.S3 | ready |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E2.S1 |
| FR2 | E2.S1 |
| FR3 | E2.S2 |
| FR4 | E2.S3 |
| FR5 | E2.S3 |
| FR6 | E2.S3 (gaps and the interval), E2.S1 (halves for back-to-back) |
| FR7 | E2.S1 (icon and description), E2.S2 (worst severity, every clash described) |
| FR8 | E3.S1 |
| FR9 | E3.S2 |
| FR10 | E2.S1, E3.S1, E3.S2 |
| FR11 | E2.S1 (error), E2.S2 (warning), E2.S3 (info) |
| FR12 | E2.S1 |
| FR13 | E2.S1, E3.S1, E3.S2 |
| NFR (demo data) | E1.S1 |

## Notes

- **Order:** E1.S1 comes first, so each rule can be seen in the demo as it lands. Nothing else depends on it.
- **No new API is expected.** The rules are plain, unit-tested functions over the saved running order and the roles, which the casting pages already load.
- **Size:** E2.S1 is the largest, because it builds the clash calculation and the shared icon with its description. If it passes ~400 changed lines, split the phone write-out into its own story.
- **Browser layout tests (ADR 0011):** ask the user at build time whether to add the demo pages or the written-out phone descriptions to them.
