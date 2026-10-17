---
id: remote-data.E2.S3
title: Delete a cast member and uncast them in one change
epic: E2
status: ready
---

## Story

As a member of the production team, I want deleting someone to take them out of every role in the same change, so that nobody is ever left cast after they've been deleted, even if something fails part-way.

## Acceptance criteria

### AC1: Deleting removes them everywhere
Given Jo is cast in 3 roles
When I delete Jo
Then Jo is gone from the cast and from all 3 roles, with the files and with the remote database

### AC2: A failed delete changes nothing
Given Jo is cast in 3 roles and the delete is refused (for example Jo was edited since I loaded the page)
When the delete fails
Then Jo is still in the cast and still in all 3 roles

### AC3: Someone in no roles is deleted as before
Given Sam is in no roles
When I delete Sam
Then Sam is gone from the cast and the roles are unchanged

### AC4: Someone in many roles is still fully uncast
Given Jo is cast in 120 roles
When I delete Jo
Then Jo is gone from the cast and from all 120 roles

### AC5: The same rules are tested against both stores
Given the shared delete tests
When `pnpm check` and the database CI job run
Then they pass against the in-memory stores and against the remote store on the emulator

## Notes

- FRs: FR7
- Depends on: remote-data.E2.S1, remote-data.E2.S2
- Replaces the delete handler's uncast–delete–uncast sequence with one store operation (ADR 0015). Past 99 roles, the remote store can't fit the change in one transaction, so AC4 relies on ADR 0015's fallback sweep.
- Out of scope: any change to what the user sees when deleting.
