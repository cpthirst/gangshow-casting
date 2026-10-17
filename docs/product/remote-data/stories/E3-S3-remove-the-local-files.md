---
id: remote-data.E3.S3
title: Remove the local files only once the copy is proven
epic: E3
status: done
---

## Story

As a maintainer, I want removing the local data files to be refused until a verification has passed since the last copy, so that I can never delete the only copy of the show's data.

## Acceptance criteria

### AC1: Refused without a passing verification
Given production 2027 has no passing verification on record
When I run the removal for production 2027
Then it refuses, says to run the verification first, and removes nothing

### AC2: Refused if the copy ran again since
Given a verification passed, and the copy was run again afterwards
When I run the removal
Then it refuses, says to verify again, and removes nothing

### AC3: It lists and asks first
Given a verification passed after the last copy
When I run the removal
Then it lists the files it will remove and asks me to confirm
And if I don't confirm, nothing is removed

### AC4: Confirmed removal removes only that production's data
Given a passing verification after the last copy, and I confirm
When the removal runs
Then the production's local data files are removed, other productions' files are untouched, and it reports what was removed

### AC5: Remote data is untouched
Given the removal ran
When the API reads production 2027 from the remote database
Then all its data is still there

## Notes

- FRs: FR10
- Depends on: remote-data.E3.S2
- Tested in a temporary folder with made-up data only; never run against real data in tests.
- Out of scope: removing remote data.
