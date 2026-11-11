---
id: hosting.E3.S4
title: Sign in on a page that looks like iCUE
epic: E3
status: done
---

## Story

As a production team member, I want the sign-in page to look like iCUE, with the Chester Gang Show logo and the app's colours, so that I know I'm in the right place before I type my password.

## Acceptance criteria

### AC1: The sign-in page carries the show's logo and colours
Given the app is deployed
When "sam" opens it and is sent to sign in
Then the sign-in page shows the Chester Gang Show logo
And its "Sign in" button is the app's red, on the app's grey background

### AC2: The new-password page looks the same
Given an admin created "sam" with a temporary password
When "sam" signs in with it for the first time
Then the page asking for a new password has the same logo and colours as the sign-in page

### AC3: The sign-in page stays light in dark mode
Given "sam"'s phone is set to dark mode
When they're sent to sign in
Then the sign-in page shows the same light colours as the app, not a dark version

### AC4: Signing in still works as before
Given an account "sam" with a password "sam" has already chosen
When "sam" signs in on the new page
Then they're returned to the page they asked for, with the production's data showing
And signing out and in again still asks for their password

## Notes

- FRs: FR5, FR6
- Depends on: hosting.E3.S2 (done)
- How it's built:
  - The login domain moves from Cognito's classic Hosted UI to its newer managed login (`managedLoginVersion: NEWER_MANAGED_LOGIN` on the domain).
  - A managed-login branding resource for the web client sets the look, kept in the CDK app so it's in code, not the console.
  - Use the existing `logo-small.jpg` (the sidebar's) and the colours in `apps/web/src/assets/styles.css`:
    - `--red-deep` for the button, because white text on it passes contrast
    - `--surface` for the page background
    - `--text` for the text
  - Branding applies to every managed login page, so AC2 comes free with AC1.
  - The sign-in flow, `oidc-client-ts`, the CSP's login domain and the API don't change.
- Cost: managed login branding needs the Essentials feature plan, which is free for up to 10,000 monthly active users. The pool is already on Essentials, because it's CDK's default for a new pool. Set the plan explicitly so it can't drift.
- [ADR 0041](../../../adr/0041-branded-managed-login.md) amends ADR 0018: the newer managed login, with branding in CDK, on the Essentials plan.
- How each AC is verified:
  - An infra assertion that the domain uses the newer managed login.
  - An infra assertion that the web client has branding with the logo and colours, light mode only.
  - An infra assertion that the pool is on the Essentials plan.
  - After the deploy, check by hand that the page looks right (AC1–AC3) and run `pnpm check:hosted` (AC4).
  - Also check by hand that the page doesn't scroll sideways at 320px. The page is Cognito's, so the browser tests can't walk it.
- Deploying replaces the classic pages in place. Anyone part-way through signing in when it happens just starts again.
- Out of scope:
  - A custom login domain. That needs a domain the show owns, and the app is on its `cloudfront.net` address.
  - Changing the page's wording. Cognito's managed login doesn't allow it.
  - Our own sign-in screens (ADR 0018 "Revisit if").
