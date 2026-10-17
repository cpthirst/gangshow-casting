---
id: remote-data.E2.S2
title: Keep roles in the remote database
epic: E2
status: done
---

## Story

As a maintainer, I want the roles and who is cast in them kept in the remote database, so that casting survives the loss of my laptop.

## Acceptance criteria

### AC1: Listing, adding, editing and removing roles work remotely
Given the API is configured for the remote database
When I add a role with members, rename it, change its members, list the roles, and then remove it
Then each step shows the expected roles, as with the files

### AC2: Role names stay unique within an item
Given item 3 has a role called "Captain"
When I add or rename another role in item 3 to "captain"
Then it is refused as a duplicate name, and nothing changes

### AC3: Two saves can't create the same name at once
Given two adds of a role called "Mate" to item 3 arrive at the same time
When both are saved
Then exactly one succeeds and the other is refused as a duplicate

### AC4: Renaming frees the old name
Given a role in item 3 was renamed from "Captain" to "Skipper"
When I add a new role called "Captain" to item 3
Then it is added

### AC5: Ids are never reused, and stale edits are refused
Given a role at revision 2, and the highest role id so far is 40
When an edit arrives from revision 1, and then a new role is added
Then the edit is refused as stale, and the new role gets id 41

### AC6: The same rules are tested against both stores
Given the shared role-store tests
When `pnpm check` and the database CI job run
Then they pass against the in-memory store and against the remote store on the emulator

## Notes

- FRs: FR5 (roles), FR6 (roles)
- Depends on: remote-data.E1.S1
- Checking that members and items exist stays a read before the write, as today (ADR 0015).
- Out of scope: uncasting a deleted member (E2.S3).
