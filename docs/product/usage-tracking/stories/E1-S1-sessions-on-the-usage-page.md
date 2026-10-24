---
id: usage-tracking.E1.S1
title: Record sessions and show them on an admin-only Usage page
epic: E1
status: ready
---

## Story

As an admin, I want to see when each person on the team last used the app and how often, so that I know who is using it and who might need help getting started.

## Acceptance criteria

### AC1: Signing in records a session
Given a team member "robin" with no sessions recorded
When "robin" signs in
Then a session for "robin" is recorded at the time they signed in

### AC2: Coming back while still signed in records a session
Given "robin" signed in earlier and their sign-in is still valid
When "robin" opens the app again, or reloads it, without typing a password
Then another session for "robin" is recorded

### AC3: A session is recorded for read-only members too
Given a Read-Only Team Member "sky"
When "sky" signs in
Then a session for "sky" is recorded, even though "sky" can change nothing else

### AC4: A session is always recorded for the person signed in
Given "robin" is signed in
When the app asks to record a session that names "alex"
Then the session recorded is "robin"'s, and nothing is recorded for "alex"

### AC5: A failed recording doesn't get in the way
Given recording a session fails (for example, the API returns an error or can't be reached)
When "robin" signs in
Then "robin" reaches the Welcome page as normal
And no error or notice about recording is shown

### AC6: Admins see a Usage page in the menu
Given a signed-in admin
When they open the menu
Then it has a "Usage" page after Accounts

### AC7: Other roles don't see the Usage page
Given a signed-in Casting Team Member or Read-Only Team Member
When they open the menu
Then it has no "Usage" page
And going to the Usage page's address shows that the page is for admins only

### AC8: The API refuses usage data to anyone but admins
Given a signed-in Casting Team Member or Read-Only Team Member
When they request the usage data
Then the response is 403
And it contains no usage data

### AC9: Every account is listed with its sessions
Given accounts "alex", "robin", "sky" and "kit"
And in the last 30 days "robin" had sessions on 1 and 20 October 2026, "alex" had one on 22 October 2026, and "sky" and "kit" have never signed in
When an admin opens the Usage page on 23 October 2026
Then "robin" shows a last session of 20 October 2026 and 2 sessions
And "alex" shows a last session of 22 October 2026 and 1 session
And "sky" and "kit" are listed with no sessions

### AC10: Only the last 30 days are counted
Given "robin" had a session 31 days ago and one 2 days ago
When an admin opens the Usage page
Then "robin" shows 1 session
And their last session is 2 days ago

### AC11: Records expire after 90 days
Given a session was recorded
Then it is removed automatically once it is 90 days old
And until it is removed, the Usage page never counts or shows a session older than 90 days

### AC12: The page says when recording started
Given the first session was recorded on 24 October 2026
When an admin opens the Usage page
Then it says usage has been recorded since 24 October 2026

### AC13: An empty Usage page explains itself
Given no session has been recorded yet
When an admin opens the Usage page
Then it lists every account with no sessions
And it says nothing has been recorded yet

### AC14: Local development and the demo never record to the real data
Given the app running with `pnpm dev` or `pnpm demo`
When the local admin uses the app and opens the Usage page
Then sessions are recorded only for the made-up local accounts, and only for as long as the local API runs
And nothing is written to the remote table

### AC15: The Usage page fits a phone
Given an admin on a 320px-wide screen
When they open the Usage page
Then nothing scrolls sideways

## Notes

- FRs: FR1, FR3, FR4, FR5, FR9, FR11
- Depends on: none. [ADR 0023](../../../adr/0023-usage-records-in-the-data-table.md) decides where usage is stored, the routes, and how records expire. It amends ADR 0018's team data.
- AC3: ADR 0023 opens `POST /api/usage` to every role, as an exception to ADR 0020.
- AC4: who comes from the sign-in token, never from the request body.
- AC14: locally, accounts are the made-up ones in `local-accounts.ts`, so usage for them must stay in memory, like the accounts do.
- AC15 is covered by the browser layout tests. Ask the user before adding the Usage page to the walks (CLAUDE.md).
- The per-person summary shows only sessions here. E2 adds page, view and export counts to it.
- Out of scope: recording page, view or export use (E2), totals per feature (E3.S1), the activity list (E3.S2), choosing a date range (E3.S3).
