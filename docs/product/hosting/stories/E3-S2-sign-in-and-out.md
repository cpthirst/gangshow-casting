---
id: hosting.E3.S2
title: Sign in with an assigned username, and sign out
epic: E3
status: done
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
When the wrong password is entered for "sam" 5 times in a row
Then further attempts for "sam" are refused for a while, with the wait growing after each further failure

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
And signing in again asks for their password rather than signing them straight back in

### AC8: Locally there's no sign-in
Given the app running with `pnpm dev` or `pnpm demo`
When a page is opened
Then it shows the data with no sign-in screen, as an admin

## Notes

- FRs: FR3, FR5, FR6, FR7, FR8, FR18
- Depends on: hosting.E3.S1
- ADR 0018: Cognito managed login with PKCE, through `oidc-client-ts`, on a Cognito prefix domain. The access token lasts 1 hour and the refresh token 1 day. The client id, the login domain and the app's address reach the pages' build at deploy time. The app client's callback and sign-out URLs are the app's address. The pages' CSP allows the login domain.
- How each AC is verified:
  - AC3 is the app client's "prevent user existence errors" setting, covered by an infra assertion plus a manual check after deploy.
  - AC4 is Cognito's built-in lockout, which isn't configurable, so it's checked manually only.
  - AC2 comes from the temporary-password flow (E1.S2, E4.S1), checked manually.
- AC7 needs Cognito's own logout endpoint called, not just the tokens cleared. Otherwise Cognito's session cookie signs the person straight back in.
- Try the sign-in screens with a team member. If they're confusing, raise it (ADR 0018 "Revisit if").
- Ask before adding any browser test (CLAUDE.md).
- Out of scope: self-service forgotten password (non-goal), hiding admin actions (E3.S3).
- As built: the deploy writes `/config.json` (`SignInConfig` in `packages/shared`) next to the pages, as the app's address is only known once deployed. The Vite dev server (`pnpm dev`, `pnpm demo`, the browser tests) never signs in. Every built app does, so a missing config can't switch sign-in off. Tokens are renewed when a request needs one, using the day's refresh token only.
- To check by hand after the first deploy: AC2 (temporary password), AC3 (same message for a wrong password and an unknown user), AC4 (lockout), and that signing out and in again asks for the password (AC7).
- Follow-up from E3.S1 still open: once the day's sign-in runs out, a 401 replaces the page, so an unsaved draft is lost. That now happens at most once a day; keeping the draft across sign-in is a possible story.
