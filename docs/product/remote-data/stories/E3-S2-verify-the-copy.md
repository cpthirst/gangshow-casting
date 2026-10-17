---
id: remote-data.E3.S2
title: Verify the copy through the API
epic: E3
status: ready
---

## Story

As a maintainer, I want to check that the app returns the same data from the remote database as from the local files, so that I know the copy is complete before I rely on it.

## Acceptance criteria

### AC1: A matching copy passes
Given the remote database holds an exact copy of production 2027's files
When I run the verification for production 2027
Then it reads the cast, roles, item notes, the latest running order and every running-order version through the API from both sources
And reports a pass, with a count for each collection

### AC2: A difference fails, naming where
Given the remote database is missing role 7, and cast member 12's revision differs
When I run the verification
Then it reports a failure listing "roles: 7 missing" and "cast: 12 differs", with no names or notes

### AC3: A passing verification is recorded
Given the verification passes
When it finishes
Then it records the pass for production 2027 with the time, for the removal step to check

### AC4: A failure clears any earlier pass
Given an earlier verification passed
When a later verification fails
Then no passing verification is on record for that production

## Notes

- FRs: FR9
- Depends on: remote-data.E3.S1
- "Through the API" means calling the same handlers the app uses, once with the file stores and once with the remote stores, so the check covers the data layer the app will use.
- The record of a pass lives beside the local data, never in the repository.
- Out of scope: removing the files (E3.S3).
