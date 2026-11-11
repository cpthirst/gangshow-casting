# 0041. Cognito's newer managed login, branded in code

- **Status**: Accepted. Amends [ADR 0018](0018-access-control-with-cognito.md)'s sign-in screens
- **Date**: 2026-11-11
- **Deciders**: Nick Hirst

## Context

ADR 0018 sends the team to Cognito's sign-in pages on the pool's prefix domain. Because it didn't choose a version, the domain serves the classic Hosted UI: a plain AWS page that looks nothing like iCUE. Volunteers, many signing in on a phone at a rehearsal, should recognise the page as the show's before they type a password (hosting.E3.S4). ADR 0018 already expected the pages "may not match the app's look".

The app is served from its CloudFront address (`*.cloudfront.net`). The show doesn't own a domain for it.

## Options considered

1. **Keep the classic Hosted UI**: no change. Cons: it allows only a logo and a few CSS classes, and it looks like a page from AWS, not from the show.
2. **Cognito's newer managed login, branded by a `ManagedLoginBranding` resource in the CDK app**: logo, colours, background and light or dark mode for every managed page, including the first-login new-password page. The sign-in flow, `oidc-client-ts`, the CSP and the API don't change. It needs the Essentials feature plan, which is free for up to 10,000 monthly active users. Cons: the page's wording and font can't change. Settings Cognito doesn't recognise are ignored without an error, so a mistake shows only on the deployed page.
3. **A custom login domain** (such as `login.<show domain>`): the address would look like the show's. Cons: it needs a domain the show owns, an ACM certificate in us-east-1 and DNS records, and the app itself is still on `cloudfront.net`. It changes the address but not the look.
4. **Our own sign-in screens using the Cognito API**: full control of look and wording. Cons: password sign-in must be turned on for the web client, and we'd own the security-sensitive screens ADR 0018 chose not to write.

## Decision

We will use option 2:

- **Domain**: the login domain uses the newer managed login (version 2).
- **Feature plan**: the pool is explicitly on the Essentials plan. It already was, as CDK's default for a new pool; setting it in code stops it changing unnoticed.
- **Branding**: one branding style for the web client, defined in `infra/lib/login-branding.ts`:
  - it uses the app's `logo-small.jpg` as the form logo;
  - colours are read at synth from `apps/web/src/assets/styles.css`, so the app and the sign-in page share one palette;
  - it is light only, as the app has no dark mode;
  - settings it leaves out keep Cognito's defaults.
- **No console edits**: the branding lives only in code. Change it there and deploy. An edit in the console's branding editor drifts from the stack and is lost at the next deploy.

## Consequences

- **Easier**:
  - The sign-in page looks like iCUE, with no code of our own on it.
  - A change to the app's colours or small logo reaches the sign-in page at the next deploy.
- **Harder**:
  - The look can only be checked on a deployed page, by eye.
  - The logo's bytes sit in the CloudFormation template, adding about 20 KB.
- **Revisit if**:
  - the show gets its own domain (then consider option 3 for the app and the login together);
  - volunteers find the managed pages confusing (option 4, as ADR 0018 says);
  - the team grows towards Essentials' free allowance.
