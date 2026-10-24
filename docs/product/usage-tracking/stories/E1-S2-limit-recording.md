---
id: usage-tracking.E1.S2
title: Stop one account flooding the usage records
epic: E1
status: draft
---

## Story

As an admin, I want one account's usage to count sensibly even if its app sends records over and over, so that the Usage page stays quick and its counts stay meaningful.

## Acceptance criteria

### AC1: Repeated sessions close together count once
Given "robin" has a session recorded at 19:00
When "robin"'s app records another session at 19:05
Then the Usage page still shows one session for "robin" for that hour

### AC2: A flood of requests doesn't slow the Usage page
Given one account's app sends 10,000 session records in a minute
When an admin opens the Usage page
Then it loads within 3 seconds (PRD Performance)

## Notes

- FRs: PRD Security NFR (no flooding)
- Depends on: usage-tracking.E1.S1
- Raised by the E1.S1 security review (OWASP A04). It suggested two ways to fix this:
  - **Throttling** the route at API Gateway. That's an infra change needing an ADR.
  - **Coarse sessions:** a key per person per hour, written only if it doesn't exist yet. That also stops reloads counting as new sessions, which changes FR1's "reloading counts". Agree which with the user before refining this story.
- Open questions: should a reload within the hour still count as a session (FR1 says it does today)? Which fix?
