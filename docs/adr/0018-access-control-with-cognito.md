# 0018. Access control with Cognito: assigned usernames and an admin group

- **Status**: Accepted
- **Date**: 2026-10-17
- **Deciders**: Nick Hirst

## Context

ADR 0010 requires an access-control decision before cast data is hosted. The hosting PRD asks for:
- sign-in from the first deploy;
- accounts created by admins with a username they choose, a temporary password, and no email or phone;
- a new password at first sign-in and after a reset;
- 1-day sign-in, with a disabled account cut off within 1 hour;
- an admin role for user management, deleting cast members and saving running orders;
- local development with no sign-in.

The team is 5–20 non-technical volunteers. Cost must be close to £0. The hosting is API Gateway and Lambda (ADR 0017).

## Options considered

1. **Our own username and password login** (scrypt hashes and opaque sessions in DynamoDB, an auth wrapper in `routes.ts`): no new service, and it runs identically locally. Cons: about 150–250 lines of security-sensitive code to own (hashing, lockout, timing, sessions), plus our own sign-in, password-change and user-admin screens.
2. **Cognito user pool, username sign-in, admin-created users, an `admin` group, and an API Gateway JWT authorizer**: free at this size (inside the free monthly-active-user allowance); password storage, lockout, the forced first-login change and token revocation are built in; requests without a valid token are refused before any handler runs. Cons: the pool can't run locally; it's another AWS service; the provided sign-in screens are only partly customisable.
3. **A shared password in front of the whole app** (CloudFront basic auth): the least work. Cons: no individual accounts, admin role, or way to revoke one person.

## Decision

We will use option 2:

- **User pool** in eu-west-2, retained when the stack is removed:
  - sign-in by case-insensitive username only;
  - self sign-up off;
  - no email or phone attributes, so no account recovery by message;
  - Cognito's default password policy and lockout.
- **Creating and resetting accounts**: the user-management Lambda (ADR 0017) does this, and only it may.
  - Accounts are created with `AdminCreateUser` and the invitation message suppressed, so the temporary password is shown to the admin.
  - A reset uses `AdminSetUserPassword` with a temporary password, then `AdminUserGlobalSignOut`.
  - Disabling uses `AdminDisableUser`, then the same global sign-out.
  - The user's next sign-in requires a new password.
  - A suppressed invitation returns no password, so our code generates every temporary password with a cryptographically secure generator that meets the pool's policy. It's shown once and never logged.
  - A repo script does the same for the first admin and lockout recovery (PRD FR14), using the maintainer's AWS credentials. It also creates the post-deploy check's accounts (one admin, one not) with permanent passwords.
  - The post-deploy check signs in through a separate check app client that allows only `ADMIN_USER_PASSWORD_AUTH`, which needs the maintainer's AWS credentials. The public app client used by the pages allows only the PKCE code flow, with "prevent user existence errors" turned on.
- **Tokens**: access and ID tokens last 1 hour, and the refresh token lasts 1 day. Disable and reset revoke refresh tokens, so access ends within an hour.
- **Sign-in screens**: Cognito's managed login pages, authorization-code flow with PKCE, handled in the SPA by `oidc-client-ts`. Tokens are kept in `localStorage` so sign-in survives closing the tab for the day. A strict CSP (ADR 0017) limits the XSS exposure that brings.
  - The managed login needs a Cognito prefix domain, and the app client's callback and sign-out URLs set to the CloudFront address. The client id, login domain and address reach the SPA build at deploy time.
  - Signing out calls Cognito's own logout endpoint as well as clearing tokens, because Cognito's session cookie would otherwise sign the person straight back in.
  - The managed login's feature tier (Lite or Essentials) must stay within the free monthly-active-user allowance at our size. Confirm this on the AWS pricing page when the pool is created.
- **API enforcement**: the HTTP API's JWT authorizer, pointing at the pool and app client, is on every route by default, including a `$default` catch-all, so unknown paths get 401 rather than 404. A route can be public only if it's listed explicitly in the infra code.
  - **Admin**: a Cognito group `admin`, read from the `cognito:groups` claim. Routes that need it are marked admin-only in `routes.ts`. The entry point refuses them with 403 before the handler runs, so a new admin route can't forget the check.
- **Locally**: `dev-server.ts`, the demo and the browser tests pass a fixed fake admin identity and never contact Cognito. User management runs against an in-memory user directory, like the stores' in-memory twins.

## Consequences

- **Easier**:
  - No password or session code of our own.
  - Lockout, revocation and the first-login change come built in.
  - Handlers stay framework-free and just read claims.
  - No new personal data: only usernames, chosen by admins.
- **Harder**:
  - The real sign-in path only runs after a deploy, so the post-deploy check (PRD FR17) is the end-to-end test of it.
  - The managed login pages may not match the app's look.
  - Forgotten passwords always need an admin.
  - Tokens in `localStorage` are exposed if an XSS ever happens.
- **Accepted risks** (decided by the maintainer, 2026-10-17, when the pool was first deployed):
  - **Password policy:** Cognito's default (at least 8 characters, mixed character types), not a longer minimum.
  - **No MFA:** not even optional app-based codes, to keep sign-in simple for volunteers.
  - **No alarms** on API or function errors. Problems are found by the post-deploy check, or reported by users.

  Reviewers shouldn't raise these again, unless a change makes them worse.
- **Revisit if**:
  - volunteers find the managed login pages confusing (then use our own screens with the Cognito API);
  - the team wants self-service reset (that needs an email per user and an ADR 0010 update);
  - per-production permissions are needed.
