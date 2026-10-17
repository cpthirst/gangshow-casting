---
id: hosting.E1.S2
title: Create or restore an admin account from the repo
epic: E1
status: ready
---

## Story

As a maintainer, I want to create the first admin, or get an admin back in after a lockout, in one step from the repo, so that the team's accounts can never be left with nobody able to manage them.

## Acceptance criteria

### AC1: Create the first admin
Given the hosted user pool has no account named "pat"
When the maintainer runs the admin script for username "pat"
Then an account "pat" exists and is an admin
And the script prints a temporary password once
And "pat" must choose a new password at first sign-in

### AC2: Restore a locked-out admin
Given an account "pat" exists but is disabled, isn't an admin, or has a forgotten password
When the maintainer runs the admin script for username "pat"
Then "pat" is enabled and an admin
And the script prints a new temporary password once
And "pat" is signed out everywhere

### AC3: No invitation is sent
Given the admin script creates an account
When it finishes
Then no invitation message was sent, because accounts have no email or phone

### AC4: A username is required
Given the maintainer runs the admin script without a username, or with one containing spaces
When it starts
Then it stops with a message saying how to give a username
And no account is changed

### AC5: The post-deploy check signs in
Given a check account exists
When the maintainer runs the post-deploy check with that account's credentials
Then it reports that a signed-in `GET /api/health` returns 200
And it still reports the no-sign-in refusals from E1.S1

## Notes

- FRs: FR14, FR17
- Depends on: hosting.E1.S1
- The script uses the maintainer's AWS credentials and profile (see the remote-data guide). It never writes the username or password to a file or log.
- The check account's credentials come from the maintainer at run time, never from the repository.
- Tests use a fake user directory and made-up usernames, never AWS.
- Out of scope: managing accounts from the app (E4).
