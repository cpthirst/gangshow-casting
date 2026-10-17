---
id: remote-data.E3.S1
title: Copy a production's data to the remote database
epic: E3
status: done
---

## Story

As a maintainer, I want to copy a production's data from the local files to the remote database in one step, so that the move is quick, complete and repeatable.

## Acceptance criteria

### AC1: Everything is copied, exactly
Given the 2027 production's local files hold cast members, roles, item notes and 6 running-order versions
When I run the copy for production 2027
Then the remote database holds all of them with the same ids, revisions and version numbers
And the next cast member or role added gets the same id it would have had with the files

### AC2: Running it again changes nothing
Given the copy has already run
When I run it again
Then nothing is duplicated or overwritten, and it reports that everything was already there

### AC3: It won't overwrite different remote data
Given the remote database already holds a cast member 12 that differs from the local file's member 12
When I run the copy
Then it stops before writing anything, and reports the difference by collection and id only

### AC4: It never prints personal details
Given any run of the copy
When it reports progress, success or a failure
Then it names collections, ids and counts only, never names or notes

### AC5: It leaves the local files alone
Given any run of the copy
When it finishes
Then the local files are unchanged

## Notes

- FRs: FR8
- Depends on: remote-data.E2.S3, remote-data.E2.S4
- Planning, reporting and the command's checks are tested in `pnpm check`; the writes themselves (copy, re-run, refusal, counters, files untouched) against the emulator in the database CI job. Made-up data only.
- Out of scope: verifying through the API (E3.S2), removing the files (E3.S3).
