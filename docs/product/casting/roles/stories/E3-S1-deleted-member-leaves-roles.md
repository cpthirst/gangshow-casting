---
id: casting-roles.E3.S1
title: Remove a deleted cast member from every role
epic: E3
status: done
---

## Story

As a member of the production team, I want deleting someone from the cast to also take them out of every role, so that no trace of a person who has left is kept and their parts show as needing recasting.

## Acceptance criteria

### AC1: A deleted member's single-person roles become uncast
Given "Sam Example" plays "Captain Hook" in "Pirate Sketch" and "Narrator" in "Campfire Song"
When I delete "Sam Example" from the cast list
Then the "Captain Hook" and "Narrator" cards show "Uncast"

### AC2: A deleted member leaves ensembles, and the others stay
Given the ensemble "Pirates" has "Sam Example" and "Alex Sample"
When I delete "Sam Example" from the cast list
Then the "Pirates" card shows only "Alex Sample"

### AC3: The roles themselves are kept
Given "Sam Example" plays "Captain Hook"
When I delete "Sam Example" from the cast list
Then "Captain Hook" is still a role in "Pirate Sketch"

### AC4: The delete warning mentions their roles
Given "Sam Example" is cast in 2 roles
When I choose "Delete" for "Sam Example" on the Cast page
Then I'm asked "Delete Sam Example from the cast? They'll be removed from 2 roles. This can't be undone."

### AC5: The warning says "1 role" for a single role
Given "Sam Example" is cast in 1 role
When I choose "Delete" for "Sam Example" on the Cast page
Then I'm asked "Delete Sam Example from the cast? They'll be removed from 1 role. This can't be undone."

### AC6: The warning is unchanged for someone in no roles
Given "Sam Example" is in no roles
When I choose "Delete" for "Sam Example" on the Cast page
Then I'm asked "Delete Sam Example from the cast? This can't be undone."

### AC7: No reference to the member is left in stored roles
Given cast member 12 is in roles 7 and 9
When a client deletes cast member 12
Then the response is 204
And cast member 12 no longer appears anywhere in the stored roles

### AC8: The member isn't deleted if their roles can't be updated
Given cast member 12 is in role 7, and the roles can't be saved
When a client deletes cast member 12
Then the response is an error
And cast member 12 is still on the cast list

## Notes

- FRs: FR9
- Depends on: casting-roles.E1.S3, cast-management.E2.S3 (delete a cast member).
- Order matters (AC8): take the member out of the roles first, then delete them from the cast. If the second step fails, the member is uncast but still listed, which is safe to retry. If it were the other way round, a failure would leave roles pointing at someone who no longer exists.
- The delete endpoint gets the roles store, so the cast and roles stay consistent in one request.
- AC4 and AC5 deliberately extend cast-management.E2.S3's confirmation (its AC1, and its test in `CastPage.test.ts`). AC6 keeps that wording for people in no roles.
- The cast member's revision is still checked first (cast-management FR7). A stale delete changes nothing in either file.
