---
id: hosting.E3.S2
title: Sign in with an assigned username, and sign out
epic: E3
status: ready
---

## Story

As a production team member, I want to sign in with the username an admin gave me and stay signed in for the day, so that I can use the app at a rehearsal without signing in again every time I open it.

## Acceptance criteria

### AC1: Signing in shows the app
Given an account "sam" with a password "sam" has already chosen
When "sam" opens the app and signs in
Then they're returned to the page they asked for, with the production's data showing

### AC2: First sign-in asks for a new password
Given an admin created "sam" with a temporary password
When "sam" signs in with it for the first time
Then they must choose a new password before any data is shown

### AC3: A wrong password doesn't say which part was wrong
Given an account "sam"
When someone signs in as "sam" with the wrong password, or as "nobody", who doesn't exist
Then both see the same message, which doesn't say whether the username or the password was wrong

### AC4: Repeated wrong passwords are slowed down
Given an account "sam"
When the wrong password is entered for "sam" several times in a row
Then further attempts for "sam" are blocked for a while

### AC5: Still signed in later that day
Given "sam" signed in on their phone this morning
When they open the app again in the evening
Then they're still signed in

### AC6: Signed out after a day
Given "sam" signed in more than a day ago
When they open the app
Then they must sign in again before any data is shown

### AC7: Signing out ends it on that device
Given "sam" is signed in
When they choose "Sign out"
Then they're returned to the sign-in screen
And going back in the browser shows no production data

### AC8: Locally there's no sign-in
Given the app running with `pnpm dev` or `pnpm demo`
When a page is opened
Then it shows the data with no sign-in screen, as an admin

## Notes

- FRs: FR3, FR5, FR6, FR7, FR8, FR18
- Depends on: hosting.E3.S1
- ADR 0018: Cognito managed login with PKCE, through `oidc-client-ts`. Access token 1 hour, refresh token 1 day. AC2–AC4 come from the user pool's settings: infra assertions plus a manual check after deploy.
- Try the sign-in screens with a team member. If they're confusing, raise it (ADR 0018 "Revisit if").
- Ask before adding any browser test (CLAUDE.md).
- Out of scope: self-service forgotten password (non-goal), hiding admin actions (E3.S3).
