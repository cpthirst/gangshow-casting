---
id: remote-data.E1.S1
title: Keep item notes in the remote database
epic: E1
status: done
---

## Story

As a maintainer, I want the item notes kept in a remote database that is defined in code, so that the thinnest slice of production data survives the loss of my laptop, and the path for the rest is proven.

## Acceptance criteria

### AC1: The database is defined in code
Given the infrastructure code
When it is synthesised
Then it defines one pay-per-request table in eu-west-2, encrypted at rest, with point-in-time recovery keeping 7 days

### AC2: Tearing down the stack keeps the data
Given the infrastructure code
When it is synthesised
Then the table is retained if the stack is deleted

### AC3: The API uses the files unless configured otherwise
Given the API starts with no remote-database configuration
When notes are read or saved
Then the local files are used, exactly as today

### AC4: The API can use the remote database
Given the API starts configured with the remote table's name and region
When I save an item's notes and read them back through the API
Then the notes come back from the remote database

### AC5: Stale saves are refused on the remote database
Given an item's notes are at revision 2 in the remote database
When a save arrives from revision 1
Then it is refused as stale, as with the files, and the saved notes are unchanged

### AC6: The same rules are tested against both stores
Given the shared notes-store tests
When `pnpm check` runs
Then they pass against the in-memory store
And when the database CI job runs, they pass against the remote store on a local DynamoDB emulator, with no AWS credentials

### AC7: The rules are recorded
Given the change is merged
When someone reads the ADRs
Then a new ADR records the database tests as a separate CI job against an emulator
And ADR 0010 says deleted data stays in point-in-time backups for up to 7 days

## Notes

- FRs: FR1, FR2, FR3, FR4, FR5 (notes), FR6 (notes), FR11
- Depends on: none. Builds on ADR 0015 (accepted).
- Deploying is manual, by the maintainer, and needs their approval each time. AC4 is checked by the maintainer after their first deploy, and by the emulator tests in CI.
- Changes `.github/workflows/ci.yml` (a new job), so it needs the user's approval in review, as a harness/CI change.
- The emulator isn't installed locally (decided 2026-10-17), so the remote store's tests can't run in `pnpm check`. Writing them as one contract suite, run against both stores, keeps red/green honest locally.
- The demo and the browser tests keep their local made-up files.
- Configuration: `DATA_TABLE` (the table name, a stack output) and `DATA_TABLE_REGION` (default eu-west-2). The dev server says where data is kept when it starts.
- Follow-ups from review, for the guide (E4.S1) or hosting: use a dedicated least-privilege AWS profile and check which account it resolves to; add alarms on the table once the API is hosted.
- Out of scope: the other stores (E2), the budget alert (E1.S2), moving the data (E3).
