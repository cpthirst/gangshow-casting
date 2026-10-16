---
feature: casting-overview-timeline
status: approved
owner: cpthirst
date: 2026-10-16
---

# Overview timeline: PRD

## Problem

The Overview shows how much each person is cast (role-size pills) and whether they have a clash. It doesn't show *where* in the show their appearances fall. To see someone's evening (busy first half and nothing after the interval, or one item at the very end), the team has to open items one by one. They want each person's show experience at a glance, as a simple picture rather than more text.

## Users

| User | Need |
|---|---|
| Production team in a casting meeting | See at a glance where each person appears across the show, and spot gaps and bunching |
| Section leaders | See how their young people's evenings are spread across both halves |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Each person's appearances are visible at a glance | Clicks from the Overview to see which items someone is in | 0 |
| The picture matches the show | People whose dots differ from their casting in the latest saved running order | 0 |
| It works on every screen | Overview pages that scroll sideways at 320px because of the timeline, or dots smaller than about 8px | 0 |
| It never relies on colour alone | Dots told apart by colour only | 0 |

## Non-goals

- **Part sizes on the dots.** A dot shows *whether* someone is in an item, not how big their part is. The pills already show sizes.
- **Clashes on the dots.** Clash icons already sit beside the name.
- **Timing to scale.** Dot spacing doesn't reflect item lengths. The interval is a fixed, wider gap, not sized to its minutes.
- **Editing or navigating from a dot.** Dots aren't links or buttons.
- **Tooltips on phones.** Phones have no hover. The written summary (FR6) covers screen readers.
- **Stage-time balance warnings** (a later PRD).

## Functional requirements

- **FR1**: Each person's card on the Overview must show a **timeline**: one dot per item in the latest saved running order, in show order. It sits at the bottom of the card, centred, with clear space between it and the name, clash icon and pills.
- **FR2**: The two halves must be separated by a visibly wider gap, standing for the interval.
- **FR3**: A dot for an item the person is cast in (any role, any size) must be a **green circle-dot**. A dot for an item they aren't in must be a **grey plain circle**. The two differ in shape as well as colour.
- **FR4**: Every item in the running order counts, including items left out of the printed programme.
- **FR5**: Hovering a dot must show which item it is: its programme number (or that it isn't in the printed programme), its title, and, if the person is in it, their part. For example "3 · Woodland Dance: Support", or "Entr'acte (not in printed programme)".
- **FR6**: Screen readers must hear each person's timeline as one sentence, not dot by dot. For example "In 5 of 20 items: Opening Number, Pirate Sketch, Campfire Song, Night Hike, Grand Finale", or "In none of the 20 items". The dots themselves are hidden from screen readers.
- **FR7**: Someone in no items shows a timeline of all grey dots, alongside the existing "No parts yet".
- **FR8**: With no saved running order, no timeline is shown. If the roles or running order can't be loaded, no timeline is shown, and the existing "Couldn't load the casting." message stands.
- **FR9**: Each timeline must never scroll sideways. On narrow screens the dots and gaps shrink to fit on one line, but never below about 8px, so in and out can still be told apart. If a show is too big for one line even at that size, each half wraps onto its own line, and the line break marks the interval. (Changed on 2026-10-16 at the user's request, after review: it was "always one line, however small".)

## Non-functional requirements

- **Security and safeguarding**: the timeline is drawn from data the page already loads, adds no personal data, and stores nothing. Casting data stays for the production team only (CLAUDE.md). Tests and demo data use made-up names.
- **Accessibility**: WCAG 2.2 AA.
  - In and out differ in shape, not just colour (FR3).
  - Both dots have at least 3:1 contrast with the card (WCAG 1.4.11, non-text contrast).
  - Screen readers get one summary sentence per person (FR6).
  - Dots are not tab stops, so a cast of 60 doesn't add hundreds of stops.
- **Performance**: the Overview with about 60 people and 30 items (about 1,800 dots) renders in under 1 second locally.
- **UI consistency**: dots use Font Awesome's free solid icons (ADR 0013) and named colour tokens. The timeline sits within the existing card style, and hover text uses the app's existing tooltip look. `ux-reviewer` checks this.

## Constraints and assumptions

- **Data**: the latest saved running order and the roles, which the Overview already loads. No new API is expected.
- **Icons**: green circle-dot and grey circle, both in the free solid set already installed.
- **Show size**: about 20 items today, with up to about 30 to plan for.
- **Scope**: one production (2027).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rows of dots look busy with 60 cards | M | M | Small, quiet dots and generous spacing. Check in the demo show before release |
| Dots too small to read on phones | M | L | FR9 shrinks only as far as needed. The summary sentence covers the detail |
| Grey dots too faint for some users | L | M | 3:1 contrast minimum (NFR) |

## Open questions

- Should a person's dots show their part size (for example a stronger mark for leads)? Assumed not; owner: production team, after first use.
- Should tapping a dot on a phone show its item? Assumed not; owner: product.
- Should a dot link to the item's page later? Assumed not; owner: product.
