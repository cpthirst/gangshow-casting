---
id: remote-data.E2.S1
title: Keep the cast list in the remote database
epic: E2
status: done
---

## Story

As a maintainer, I want the cast list kept in the remote database, so that the most important data survives the loss of my laptop.

## Acceptance criteria

### AC1: Listing, adding and editing work remotely
Given the API is configured for the remote database
When I add a cast member, edit their details and list the cast through the API
Then the list shows them with their edited details

### AC2: Ids are never reused
Given a production whose highest cast id has been 57, and member 57 has been deleted
When I add a cast member
Then they get id 58

### AC3: Two adds at once get different ids
Given two adds arrive at the same time
When both are saved
Then both members are kept, with different ids

### AC4: Stale edits are refused
Given a cast member at revision 3
When an edit arrives from revision 2
Then it is refused as stale and the member is unchanged

### AC5: Members saved before notes existed still load
Given a cast member stored without Singing or Acting notes
When the cast is listed
Then they load with blank notes

### AC6: The same rules are tested against both stores
Given the shared cast-store tests
When `pnpm check` and the database CI job run
Then they pass against the in-memory store and against the remote store on the emulator

## Notes

- FRs: FR5 (cast), FR6 (cast)
- Depends on: remote-data.E1.S1
- Deleting works remotely as it does with files: the delete handler already uncasts through the roles store first. E2.S3, in the same PR, makes the two one all-or-nothing change. (This replaces the earlier plan to refuse remote deletes until E2.S3.)
- Out of scope: roles (E2.S2), the all-or-nothing delete (E2.S3).
