---
id: hosting.E4.S2
title: Reset a password, or disable an account
epic: E4
status: done
---

## Story

As an admin, I want to reset a forgotten password or turn off someone's access, so that people can get back in quickly and people who've left, or lost their phone, can't.

## Acceptance criteria

### AC1: Reset a forgotten password
Given an account "sam"
When an admin resets "sam"'s password
Then the admin is shown a new temporary password once
And "sam" must choose a new password at their next sign-in

### AC2: A reset signs the account out everywhere
Given "sam" is signed in on two devices
When an admin resets "sam"'s password
Then within 1 hour both devices are refused and must sign in again

### AC3: Disable an account
Given "sam" is enabled and signed in
When an admin disables "sam"
Then the list shows "sam" as disabled
And within 1 hour "sam"'s requests are refused on every device
And "sam" can't sign in

### AC4: Enable it again
Given "sam" is disabled
When an admin enables "sam"
Then "sam" can sign in again with their existing password

### AC5: An admin can't disable themselves
Given the signed-in admin is "pat"
When "pat" tries to disable "pat"
Then they're told they can't disable their own account
And "pat" stays enabled

### AC6: An unknown account
Given no account "nobody"
When an admin resets or disables "nobody" through the API
Then the response is 404
And no account changes

### AC7: Non-admins can't do it
Given a signed-in team member who isn't an admin
When they try to reset, disable or enable any account through the API
Then the response is 403

## Notes

- FRs: FR11, FR12, FR13
- Depends on: hosting.E4.S1
- ADR 0018: reset sets a temporary password then signs out everywhere. Disable does the same. "Within 1 hour" is the access-token lifetime: refresh tokens are revoked at once.
- Disabling asks for confirmation first, in the app's usual style.
- Out of scope: admin role changes (E4.S3), deleting accounts.
- As built: the API knows who's asking from the access token's `username` claim. The dev server has no sign-in (ADR 0018), so locally the "can't disable yourself" check has no one to compare and doesn't apply.
- As built: resetting a password also asks for confirmation, as it signs the person out on every device.
