---
id: hosting.E4.S1
title: List and create accounts in the app
epic: E4
status: ready
---

## Story

As an admin, I want to see everyone's account and create a new one in the app, so that I can give a new team member access in a couple of minutes, without AWS.

## Acceptance criteria

### AC1: An admin sees every account
Given accounts "pat" (admin), "sam" and "lee" (disabled)
When an admin opens the Accounts page
Then it lists "lee", "pat" and "sam" in alphabetical order
And shows which are admins and which are disabled

### AC2: An admin creates an account
Given no account "jo"
When an admin creates an account with username "jo"
Then "jo" appears in the list, not an admin and enabled
And the admin is shown a temporary password for "jo" once, to pass on
And "jo" must choose a new password at first sign-in

### AC3: A username can't be taken twice
Given an account "sam"
When an admin creates an account "Sam"
Then they're told that username is already taken
And no account is created

### AC4: The username must be valid
Given an admin on the create form
When they leave the username empty, or enter one with spaces or longer than 32 characters
Then they're told what a username can contain
And no account is created

### AC5: Non-admins can't see or manage accounts
Given a signed-in team member who isn't an admin
When they request the accounts list, or try to create an account, through the API
Then the response is 403
And the Accounts page isn't in their menu

### AC6: It works locally
Given the app running with `pnpm dev` or `pnpm demo`
When the Accounts page is used
Then accounts are listed and created in a made-up local directory, with no AWS

## Notes

- FRs: FR9, FR11, FR18
- Depends on: hosting.E3.S2, hosting.E2.S2
- ADR 0017/0018: user-management routes run in their own function, the only one allowed to change accounts. No invitation message is sent.
- The request and response shapes go in `packages/shared` first. The temporary password is returned only in the create response, never logged.
- Ask before adding any browser test for the new page (CLAUDE.md).
- Out of scope: reset and disable (E4.S2), admin role changes (E4.S3).
