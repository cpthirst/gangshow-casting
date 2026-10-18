---
id: team-roles.E5.S1
title: Check read-only access after a deploy
epic: E5
status: ready
---

## Story

As the maintainer, I want the post-deploy check to prove a read-only account can't change anything, so that I know reviewers can't edit casting on the live app.

## Acceptance criteria

### AC1: The check's read-only account is set up from the repository
Given the maintainer has AWS credentials for the stack
When they set up the check's accounts, now naming an admin, a Casting Team Member and a Read-Only Team Member
Then all three accounts exist with those roles, and their passwords are shown once

### AC2: Every change is refused for the read-only account
Given the check's accounts exist
When the maintainer runs the post-deploy check
Then it sends every change route as the read-only account
And reports a pass only if each one answers 403

### AC3: The read-only account can still read
Given the check's accounts exist
When the check runs
Then the read-only account's request to a read route answers 200

### AC4: A failure is reported without data
Given a change route wrongly accepts the read-only account
When the check runs
Then it reports a failure naming that route and the status it got
And prints no cast data

### AC5: The usernames must differ
Given the maintainer names the same username for two of the check's accounts
When they set up the accounts or run the check
Then it refuses, saying the check accounts need different usernames

## Notes

- FRs: FR15
- Depends on: team-roles.E1.S1
- As today, the check never sends a change as the admin (hosting.E2.S2 notes). Its read-only requests must be ones that would be refused before any change is made.
- The check member keeps its current role as the Casting Team Member check.
- Out of scope: the local role switch (E5.S2).
