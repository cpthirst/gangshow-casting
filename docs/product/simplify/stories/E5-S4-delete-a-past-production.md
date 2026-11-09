---
id: simplify.E5.S4
title: Let an admin delete a past production for good
epic: E5
status: done
---

## Story

As an admin, I want to delete a past production once it's no longer needed, so that the cast's personal data, mostly about children, isn't kept longer than it's needed (UK GDPR).

## Acceptance criteria

### AC1: The ADR comes first
Given no decision yet on deleting a whole production, including its files and backups
When this story starts
Then an ADR, written with the `adr` skill, says how it's done, and the maintainer accepts it before any code changes

### AC2: The confirmation names the production and the backup window
Given productions 2027 and 2028
When an admin chooses Delete on 2027 on the Productions page
Then a confirmation names 2027, says it can't be undone, and says how long copies stay in backups (up to 7 days for the data today)

### AC3: Everything about it goes
Given 2027 has a cast, running orders, casting, props, scenery, SFX and wardrobe files, mics and notes
When an admin confirms deleting 2027
Then none of that is stored any more, and 2027 is no longer listed

### AC4: Cancelling keeps it
Given an admin has chosen to delete 2027
When they cancel the confirmation
Then 2027 and its data are unchanged

### AC5: The newest can't be deleted
Given 2028 is the newest production
When an admin asks the API to delete 2028
Then the API refuses, and the pages offer no way to delete it

### AC6: Only admins can delete
Given "sam" has every permission but isn't an admin
When sam asks the API to delete 2027
Then the API refuses

### AC7: Usage records stay until they expire
Given "jo" opened 2027's pages last week
When an admin deletes 2027
Then jo's activity still shows on the Usage page until it expires after 90 days

### AC8: The other productions are untouched
Given productions 2026, 2027 and 2028
When an admin deletes 2026
Then 2027 and 2028 are unchanged, and nobody's access changes

### AC9: A delete that stopped part way can be finished
Given deleting 2027 stopped part way, as a timeout would leave it
When an admin opens the Productions page
Then 2027 is shown as not finished, nobody can open it, and the admin can only delete it again
And when the admin confirms deleting it again, the rest of it goes and 2027 is no longer listed

## Notes

- FRs: FR22, FR23
- Depends on: simplify.E5.S3
- AC2's backup window: the data table's point-in-time recovery keeps 7 days (`infra/lib/app-stack.ts`). The ADR settles the files bucket's window, and the confirmation names whichever is longer.
- AC7: usage records hold the adult team's use of the app, not cast data (ADR 0023), so they expire on their own schedule (PRD FR22).
- Deleting files touches the files bucket (ADR 0030, 0032): run `infra-reviewer` if infra changes.
- Decision: [ADR 0037](../../../adr/0037-delete-a-past-production-marked-then-repeatable.md).
