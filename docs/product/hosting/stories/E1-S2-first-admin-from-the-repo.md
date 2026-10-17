---
id: hosting.E1.S2
title: Create or restore an admin account from the repo
epic: E1
status: done
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

### AC2: Restore a disabled admin
Given an account "pat" exists but is disabled
When the maintainer runs the admin script for username "pat"
Then "pat" is enabled and an admin

### AC3: Restore admin to an account that lost it
Given an account "pat" exists but isn't an admin
When the maintainer runs the admin script for username "pat"
Then "pat" is an admin

### AC4: Restoring resets the password
Given an account "pat" exists whose password is forgotten
When the maintainer runs the admin script for username "pat"
Then the script prints a new temporary password once
And "pat" is signed out everywhere

### AC5: No invitation is sent
Given the admin script creates an account
When it finishes
Then no invitation message was sent, because accounts have no email or phone

### AC6: A username is required
Given the maintainer runs the admin script without a username
When it starts
Then it stops with a message saying how to give a username
And no account is changed

### AC7: The username must be valid
Given the maintainer runs the admin script with the username "pat smith"
When it starts
Then it stops with a message saying a username is 1–32 letters, digits, dots, hyphens or underscores
And no account is changed

### AC8: Check accounts for the post-deploy check
Given the maintainer runs the script in check-account mode for "check-admin" and "check-member"
When it finishes
Then "check-admin" is an admin and "check-member" isn't
And both have a permanent password, printed once, so they can sign in without the first-login change

### AC9: The post-deploy check signs in
Given the check accounts exist
When the maintainer runs the post-deploy check with "check-admin"'s credentials
Then it reports that a signed-in `GET /api/health` returns 200
And it still reports the no-sign-in refusals from E1.S1

## Notes

- FRs: FR14, FR17
- Depends on: hosting.E1.S1
- The script uses the maintainer's AWS credentials and profile (see the remote-data guide). It never writes a username or password to a file or log.
- Our code generates temporary and check-account passwords with a cryptographically secure generator that meets the pool's policy, because a suppressed invitation returns no password (ADR 0018).
- The check signs in through a separate check app client that allows only admin-initiated password sign-in. That needs the maintainer's AWS credentials, so the public app client used by the pages keeps the PKCE flow only (ADR 0018).
- The check accounts' credentials come from the maintainer at run time, never from the repository.
- Tests use a fake user directory and made-up usernames, never AWS.
- Out of scope: managing accounts from the app (E4).
