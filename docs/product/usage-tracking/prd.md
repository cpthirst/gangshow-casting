---
feature: usage-tracking
status: approved
owner: Nick Hirst
date: 2026-10-23
---

# Usage tracking: PRD

## Problem

The app has grown quickly: a running order, cast list, casting overview with three views, item pages, and Excel and Word exports. The maintainer can't tell who on the production team uses it, or which of these features are used at all. Without that, it's guesswork whether to improve, explain or drop a feature, and whether someone with an account has stopped using the app.

## Users

| User | Need |
|---|---|
| Admin | See who uses the app and which pages, views and exports each person uses, so they can decide what to improve and who might need help |
| Production team member (any role) | Use the app as today; recording their use must not slow it down or get in their way |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| Admins can see who uses the app | Accounts on the dashboard with a last session date, compared with accounts that have used the app | Every account appears; each one that uses the app after release shows the right last session |
| Admins can see which features are used | Pages, views and exports listed in FR2 that show a use count after someone uses them | All of them |
| Recording never gets in the way | Actions that fail or are noticeably delayed because their use couldn't be recorded | None |
| Records aren't kept longer than needed | Usage records older than 90 days | None after the 90-day limit (allowing up to a day for removal) |

## Non-goals

- Recording every button: saves, edits, casting changes, deletes and form inputs are not recorded. (The running order's own versions already show what changed.)
- Recording what someone looked at in detail, such as which cast member or which item's notes. Only which page, view or export was used, plus the item for "opened an item" (see FR2).
- Third-party analytics tools. The app makes no requests to other sites (most of the cast are under 18), and that doesn't change.
- Recording device, browser, location or IP address.
- Recording use of the help buttons or the help they open.
- Recording failed sign-in attempts or security auditing. This is about feature use, not security monitoring.
- Tracking anyone who isn't signed in.
- Exporting the usage data, charts beyond simple counts, or alerts.
- Tracking use by visitors to the demo, local development or the browser tests.

## Functional requirements

- **FR1**: The app must record a **session** each time a team member starts using the app: who (their username) and when. A session is one sign-in, which lasts a day: coming back to the app or reloading it while still signed in is part of the same session, and the first time they use the app after the day's sign-in has run out starts a new one (changed on 2026-10-24; it was every opening or reload).
- **FR2**: The app must record these **uses**, each with who, what and when:
  - opening a menu page (Welcome, Running order, Cast, Casting Overview, Casting Items, Accounts, and the new Usage page from FR4);
  - switching the Overview between its views (By person, By item, Grid);
  - opening an item's page, and which item;
  - each Excel and Word export, wherever it's offered.
- **FR3**: Recording must never stop or delay what the person was doing. If a use can't be recorded, the person sees nothing, and the action goes ahead as normal.
- **FR4**: Admins must have a **Usage** page in the menu. Other roles must not see it in the menu, and the app must refuse them the page and its data.
- **FR5**: The Usage page must show a **per-person summary**: one row per account with last session, number of sessions, and how many times they used each page, view and export, in the selected date range. Every account is listed, including those with no activity in the range and those that have never signed in, so admins can see who isn't using the app.
- **FR6**: The Usage page must show **per-feature totals**: for each page, view and export, the number of uses and the number of different people who used it, in the selected date range.
- **FR7**: The Usage page must show a **recent activity list**: each session and use, newest first, with who, what and when, in the selected date range.
- **FR8**: The Usage page must have a **date range** choice: last 7 days, last 30 days, and last 90 days. Last 30 days is the default.
- **FR9**: Usage records must be **deleted automatically** 90 days after they were made.
- **FR10**: (Dropped on 2026-10-23: the app can't delete accounts, only disable them. FR9's 90-day expiry removes a deleted account's records.)
- **FR11**: The Usage page must show when recording started, so admins know why there's no data from before release.

## Non-functional requirements

- **Security and privacy**:
  - Usage data is personal data about adult volunteers (UK GDPR). It is kept only for the purpose above (understanding feature use), for 90 days.
  - Only admins can read it. The API, not just the menu, enforces this.
  - A use is recorded only for the signed-in person making it. Nobody can record a use for someone else or invent a username.
  - One account can't flood the records: recording it many times quickly mustn't inflate its counts without limit or slow the Usage page (added on 2026-10-24 after the E1.S1 security review). The API limits how often usage can be recorded.
  - No data about the cast goes in usage records. The "opened an item" use records the item, never a cast member's name.
  - This widens what the app stores about the team beyond a username (ADR 0018), so it needs an ADR before it's built.
- **Accessibility**: WCAG 2.2 AA. The Usage page's tables work with a screen reader and a keyboard, and fit a phone at 320px without scrolling sideways, as every other page does.
- **Performance**: recording adds no noticeable delay to any page, view or export. The Usage page loads within 3 seconds for 90 days of a production team's use (about 30 accounts).
- **Cost**: stays within the existing monthly budget alert.

## Constraints and assumptions

- Builds on the existing sign-in, roles and hosting (ADR 0017, 0018, 0020). Any new storage or AWS resource needs a story and an ADR.
- Usage covers the whole app, not one production: a session isn't tied to a production.
- **No in-app notice**: the maintainer will tell the production team themselves, outside the app, that sessions and page use are recorded, why, and for how long. This is how the team learns about it, which UK GDPR requires.
- Admins' own use is recorded like everyone else's.
- The team is small (about 30 accounts), so simple counts in tables are enough. No charts.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Team members aren't told and feel watched, or it isn't lawful | M | H | The maintainer tells the team before release (see Constraints). Only feature use is recorded, kept 90 days, admins only |
| A failed recording breaks or slows a page | L | H | FR3; recording happens in the background and its failures are ignored |
| Someone records fake uses for another person | L | M | Who comes only from the person's own sign-in, never from what the page sends |
| Counts look wrong because of reloads or double-clicks | M | L | Sessions count sign-ins, not reloads (FR1). Page, view and export counts show rough use, not exact clicks. Revisit if it misleads |
| Usage records grow the database cost | L | L | 90-day removal, small records |

## Open questions

- None. Answered on 2026-10-23: coming back while still signed in counts (FR1, now called a session); accounts that have never signed in are listed (FR5); help isn't recorded (Non-goals). Changed on 2026-10-24: a session is one day-long sign-in, not every opening or reload (FR1).
