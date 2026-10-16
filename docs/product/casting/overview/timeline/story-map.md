---
feature: casting-overview-timeline
status: approved
prd: ./prd.md
---

# Overview timeline: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | See each person's show at a glance | FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9 |

## E1: See each person's show at a glance

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [casting-overview-timeline.E1.S1](stories/E1-S1-dots-per-item.md) | Each Overview card shows a row of dots, one per item in show order with a wider gap at the interval: green circle-dot where the person appears, grey circle where not; none without a saved running order or when the casting fails (walking skeleton) | FR1, FR2, FR3, FR4, FR7, FR8 | (none) | done |
| [casting-overview-timeline.E1.S2](stories/E1-S2-say-what-each-dot-is.md) | Hovering a dot names its item and the person's part; screen readers hear one sentence per person, not each dot | FR5, FR6 | E1.S1 | done |
| [casting-overview-timeline.E1.S3](stories/E1-S3-fits-every-phone.md) | Each timeline stays on one line, shrinking to fit down to 320px for up to about 30 items, with no sideways scrolling | FR9 | E1.S1 | in-progress |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E1.S1 |
| FR4 | E1.S1 |
| FR5 | E1.S2 |
| FR6 | E1.S2 |
| FR7 | E1.S1 |
| FR8 | E1.S1 |
| FR9 | E1.S3 |

## Notes

- **No new API.** The Overview already loads the running order and roles. Which items someone is in is a plain, unit-tested function.
- **E1.S3 is layout:** ask the user at build time whether to add a browser walk at 320 and 360px with a ~30-item show (ADR 0011).
- **Colours:** green and grey become named colour tokens with contrast notes. The icons are Font Awesome (ADR 0013).
