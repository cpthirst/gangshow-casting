---
feature: production-mics
status: approved
prd: ./prd.md
---

# Production Mic plot: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | Each item's Mic plot page lists the 24 channels, each given to a cast member in the item and their role, with notes | FR1, FR2, FR3, FR4, FR8, FR11 |
| E2 | A channel used by someone else in the item before can't be given out, and the mic plot keeps in step with casting and the running order | FR5, FR6, FR7, FR9, FR10 |
| E3 | The Overview, the Excel mic plot, Usage, Welcome and Help follow the new page | FR12, FR13, FR14, FR15, FR16 |

## E1: Allocating mics

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-mics.E1.S1](stories/E1-S1-give-a-channel-to-a-cast-member.md) | Walking skeleton: the Mic plot page replaces "Coming soon" with Mic 1 to Mic 24. Tech, Director and Admins can give a channel to a cast member cast in the item, or clear it; everyone else sees it read-only, with the read-only line. Someone already on a channel in the item isn't offered for another. The API enforces all of it. An item's mic plot is deleted with the item | FR1, FR2, FR3, FR4, FR11 | (none) | done |
| [production-mics.E1.S2](stories/E1-S2-choose-the-role.md) | Each channel shows its cast member's roles in the item as plain text, ensembles included, biggest part first, worked out from the casting; nothing about the role is chosen or saved | FR3 | E1.S1 | done |
| [production-mics.E1.S3](stories/E1-S3-mic-plot-notes.md) | Mic plot notes under the channels, changed by Tech, Director and Admins, deleted with the item | FR8, FR11 | E1.S1 | done |

## E2: The item-before rule and keeping in step

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-mics.E2.S1](stories/E2-S1-channel-used-in-the-item-before.md) | A channel used in the item directly before by a different cast member is greyed out and disabled, reading "Used in previous item", and the API refuses it. The cast member who had it can keep it. The rule resets at the first item and after the interval. Non-adjacent items need nothing extra | FR5, FR6, FR7 | E1.S1 | ready |
| [production-mics.E2.S2](stories/E2-S2-a-reorder-breaks-the-rule.md) | When the running order changes so a saved allocation breaks the rule, it stays shown, and the channel can only be cleared until it is | FR10 | E2.S1 | ready |
| [production-mics.E2.S3](stories/E2-S3-casting-changes-free-or-blank.md) | Taking a cast member out of an item or the cast frees their channel there. The roles shown already follow the casting (E1.S2) | FR9 | E1.S2 | ready |

## E3: Overview, export, Usage and Help

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [production-mics.E3.S1](stories/E3-S1-overview-count-notes-and-usage.md) | The Overview's Mic plot column counts allocated channels instead of a dash, Mic plot notes appear under each row after SFX notes, and the Usage page records visits to the Mic plot page | FR12, FR13, FR16 | E1.S3 | ready |
| [production-mics.E3.S2](stories/E3-S2-generate-mic-plot.md) | Generate Mic Plot beside Generate Props List downloads the Excel workbook in the 2026 layout: title, ACT 1 and ACT 2, a block per item with Mic 1–9, 10–18 and 19–24 rows of name and role, notes beside it, each item shaded in its own colour repeating per half, A4 portrait. Names stay text. Usage records each use. Includes the ADR if a new library is needed | FR14, FR16 | E1.S3 | ready |
| [production-mics.E3.S3](stories/E3-S3-welcome-and-help.md) | Welcome and Help describe the Mic plot page, the greyed-out rule and the interval, notes, who can change it, Generate Mic Plot, and that the workbook holds under-18s' names | FR15 | E2.S1, E3.S2 | ready |

## Order

E1.S1 → E1.S2 → E1.S3 → E2.S1 → E2.S2 → E2.S3 → E3.S1 → E3.S2 → E3.S3

- E1.S1 is the largest: a new store, its routes, the page and the removal clean-up. If it passes ~400 lines, the read-only view is the part to split out.
- E2.S1 is the heart of the feature, so it comes straight after allocating works.
- E3.S1 and E3.S2 can go in either order. E3.S2 may add a spreadsheet library; that choice, and an ADR if it's a runtime dependency, belong to that story.
- E3.S3 goes last, once everything it describes exists. It changes the Help and Welcome pages' code, so it is test-first.

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1 |
| FR2 | E1.S1 |
| FR3 | E1.S1, E1.S2 |
| FR4 | E1.S1 |
| FR5 | E2.S1 |
| FR6 | E2.S1 |
| FR7 | E2.S1 |
| FR8 | E1.S3 |
| FR9 | E2.S3 |
| FR10 | E2.S2 |
| FR11 | E1.S1, E1.S3 |
| FR12 | E3.S1 |
| FR13 | E3.S1 |
| FR14 | E3.S2 |
| FR15 | E3.S3 |
| FR16 | E3.S1, E3.S2 |
