---
id: usage-tracking.E4.S1
title: Count one session per sign-in, and limit how fast usage is recorded
epic: E4
status: ready
---

## Story

As an admin, I want sessions to mean sign-ins and recording to be limited, so that the Usage page's counts stay meaningful and quick even if someone's app sends records over and over.

## Acceptance criteria

### AC1: Signing in starts a session
Given "robin" isn't signed in
When "robin" signs in
Then one session is recorded for "robin"

### AC2: Coming back the same day is the same session
Given "robin" signed in at 19:00 and that sign-in still lasts
When "robin" reloads the app at 19:05, or closes it and opens it again at 21:00
Then no new session is recorded, and the Usage page shows one session for "robin"

### AC3: Coming back after the sign-in has ended starts a new session
Given "robin"'s day-long sign-in has run out
When "robin" opens the app and signs in again
Then a new session is recorded for "robin"

### AC4: A sign-in that fails records nothing
Given "robin" is sent back from the login pages without a sign-in (for example, they cancelled)
When the app opens
Then no session is recorded

### AC5: Recording usage is limited
Given the hosted app
When usage records arrive faster than 5 a second, beyond a burst of 10
Then the extra ones are refused as too many, and not recorded

### AC6: The limit is only on recording usage
Given the hosted app
Then every other route keeps the API's own limit, and isn't held to the usage limit

### AC7: A refused recording doesn't get in the way
Given recording a use is refused as too many
When "robin" opens the Cast page
Then the Cast page shows as normal, with no error or notice about recording

## Notes

- FRs: FR1 (changed on 2026-10-24), PRD Security NFR (no flooding)
- Depends on: usage-tracking.E1.S1. Changes E1.S1's AC2.
- A sign-in lasts as long as the web client's 1-day refresh token, so a session is at most one a day per device.
- Locally (`pnpm dev`, `pnpm demo`) there's no sign-in, so a session is still recorded each time the app opens.
- AC5: the limit is shared by everyone recording usage, not per account (API Gateway route throttling). It's on top of the stage's own 20 a second. Needs an ADR amending ADR 0023.
- Raised by the E1.S1 security review (OWASP A04). The user chose throttling and one session per day-long sign-in on 2026-10-24.
