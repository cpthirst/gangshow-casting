---
feature: usage-tracking
status: approved
prd: ./prd.md
---

# Usage tracking: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | Sessions are recorded, and admins see who uses the app | FR1, FR3, FR4, FR5, FR9, FR11 |
| E2 | Page, view and export use is recorded per person | FR2, FR3, FR5 |
| E3 | The Usage page's totals, activity list and date range | FR6, FR7, FR8 |
| E4 | Sessions mean sign-ins, and recording is limited | FR1, Security NFR |

## E1: Sessions and the Usage page

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [usage-tracking.E1.S1](stories/E1-S1-sessions-on-the-usage-page.md) | Walking skeleton: each sign-in or return to the app records a session (failures ignored, records expire after 90 days), and admins get a Usage page listing every account with its last session and number of sessions in the last 30 days, and when recording started. Needs the ADR first | FR1, FR3, FR4, FR5, FR9, FR11 | (none) | done |
| usage-tracking.E1.S2 | Moved to E4.S1 on 2026-10-24 | | | dropped |

## E2: Recording uses

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [usage-tracking.E2.S1](stories/E2-S1-menu-page-uses.md) | Opening a menu page is recorded, and the per-person summary shows how often each person opened each page | FR2, FR3, FR5 | E1.S1 | done |
| [usage-tracking.E2.S2](stories/E2-S2-overview-views-and-items.md) | Switching the Overview between By person, By item and Grid, and opening an item's page, are recorded and counted per person | FR2, FR3, FR5 | E2.S1 | done |
| [usage-tracking.E2.S3](stories/E2-S3-export-uses.md) | Each Excel and Word export is recorded and counted per person | FR2, FR3, FR5 | E2.S1 | done |

## E3: The rest of the Usage page

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [usage-tracking.E3.S1](stories/E3-S1-feature-totals.md) | Per-feature totals: for each page, view and export, the number of uses and of different people | FR6 | E2.S1 | done |
| [usage-tracking.E3.S2](stories/E3-S2-recent-activity.md) | A recent activity list of every session and use, newest first, with who, what and when | FR7 | E2.S1 | done |
| [usage-tracking.E3.S3](stories/E3-S3-date-range.md) | A date range choice (last 7, 30 or 90 days, 30 by default) that every part of the Usage page follows | FR8 | E3.S1, E3.S2 | done |

## E4: Sessions and limits

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [usage-tracking.E4.S1](stories/E4-S1-limit-recording.md) | A session is one day-long sign-in, not every reload, and recording usage is throttled so one account can't flood it | FR1, Security NFR | E1.S1 | ready |

## Order

E1.S1 → E2.S1 → E2.S2 → E2.S3 → E3.S1 → E3.S2 → E3.S3 → E4.S1

Records expire from the first story on, so nothing is ever kept longer than 90 days. Recording comes before the rest of the dashboard, so the page has real data to show while it's built. E2.S2, E2.S3, E3.S1 and E3.S2 only need E2.S1, so they can go in any order.

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E1.S1, E4.S1 |
| FR2 | E2.S1, E2.S2, E2.S3 |
| FR3 | E1.S1, E2.S1, E2.S2, E2.S3 |
| FR4 | E1.S1 |
| FR5 | E1.S1, E2.S1, E2.S2, E2.S3 |
| FR6 | E3.S1 |
| FR7 | E3.S2 |
| FR8 | E3.S3 |
| FR9 | E1.S1 |
| FR10 | Dropped (see PRD) |
| FR11 | E1.S1 |
| Security NFR (no flooding) | E4.S1 |
