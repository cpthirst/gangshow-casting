---
feature: hosting
status: approved
owner: cpthirst
date: 2026-10-17
---

# Hosting: PRD

## Problem

The app only runs on the maintainer's laptop. Once remote-data is done, the data lives in the cloud, but the API and the pages still only run on that laptop. So nobody else on the production team can look up who is in which item or record casting during a rehearsal unless they're standing next to the maintainer. The team works on their phones, at rehearsals and in the evenings, and needs the app wherever they are.

The app can't simply be put online. Most of the cast are under 18, and casting data must only ever reach the production team (ADR 0010). So it needs sign-in from the very first deploy. Some actions are also permanent or affect the whole show, such as deleting a cast member, changing the running order or managing who has access. These should be limited to a few trusted admins.

## Users

| User | Need |
|---|---|
| Production team member | Open the app on their phone or computer from anywhere, sign in with the username they were given, and use it exactly as today. |
| Admin (a few trusted team members) | Everything a team member can do, plus: create accounts with a username they choose, reset forgotten passwords, disable accounts, grant or remove admin, delete cast members and save the running order. |
| Maintainer | Deploy and update the hosted app from code, create the first admin, and check that nothing is reachable without signing in. |
| Developers and CI | Keep developing and testing locally without the hosted sign-in or any AWS account. |

## Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| The team uses the app without the maintainer's laptop | Every page and every save works with the laptop switched off | 100% of pages and saves |
| Nobody outside the team can see cast data | API routes that return data, or accept a change, without a valid sign-in, checked after every deploy | 0 |
| Admin-only actions stay admin-only | Admin-only actions the API accepts from a non-admin, covered by tests and the post-deploy check | 0 |
| Admins manage access without AWS | Time for an admin to create an account or reset a password in the app, without the AWS console or a script | Under 2 minutes |
| A disabled account stops working quickly | Time from an admin disabling an account, or resetting its password, until that account's requests are refused on every device | Within 1 hour (now 5 minutes: team-roles FR13) |
| It costs next to nothing | Monthly AWS bill for hosting, sign-in and data at the team's usage | Under £5 a month (the existing budget alert), and nothing for idle servers |
| It's quick on a phone | Time for a page's data to load on a UK 4G phone | Under 1.5 seconds usually; under 4 seconds for the first request after a quiet spell |

## Non-goals

- **Email or phone numbers for team members, or self-service "forgot password".** Accounts have a username only. An admin resets a forgotten password.
- **Invitation emails or self sign-up.** Admins create every account and hand over the username and temporary password in person or by message.
- **A custom web address.** The team uses the address the hosting provides, and bookmarks it.
- **Deploying from CI, or a staging copy.** The maintainer deploys by hand, as with remote-data.
- **Two-step sign-in (MFA) for team members.** This can be revisited later.
- **Permissions per production, or roles beyond team member and admin.**
- **A log of who changed what.**
- **Offline use, or a public page for parents or cast.**
- **Changing the demo show or the browser tests.** They stay local and need no sign-in.

## Functional requirements

### Reachable from anywhere
- **FR1**: The app is reachable from any internet connection over HTTPS, at one web address that serves both the pages and the API. Plain HTTP is redirected or refused.
- **FR2**: Every API request without a valid sign-in is refused, and no cast data, item data or error detail is returned. This applies to every route, including routes added later, unless one is deliberately and visibly made public.
- **FR3**: Without a sign-in, the pages show no production data and send the person to sign in.
- **FR4**: API responses are never cached or stored on the way to the browser, so one person's response can't reach another.

### Signing in
- **FR5**: A team member signs in with a username and password that an admin gave them. There's no way to create your own account.
- **FR6**: A team member's first sign-in, and their first sign-in after an admin resets their password, makes them choose a new password before they can see any data.
- **FR7**: A team member stays signed in on a device for up to 1 day, then signs in again. Signing out ends it on that device straight away.
- **FR8**: Repeated wrong passwords for a username are slowed down or temporarily blocked. The error never says whether the username or the password was wrong.

### Admins
- **FR9**: Only admins can delete a cast member, save a new running-order version, and manage users. The API refuses these from anyone else, however the request is made.
- **FR10**: Non-admins don't see the admin-only actions, or see them disabled with a short reason ("Only admins can …"). Everything else works for every signed-in team member as it does today.
- **FR11**: An admin can see every account (username, whether it's an admin, whether it's disabled) and can:
  - create an account with a username they choose and a temporary password;
  - reset an account's password to a new temporary one;
  - disable an account, or enable it again;
  - make an account an admin, or remove admin.
- **FR12**: Disabling an account or resetting its password ends that account's access on every device within 1 hour. (Tightened to 5 minutes by team-roles FR13.)
- **FR13**: There is always at least one enabled admin. An admin can't disable themselves or remove their own admin role.
- **FR14**: The maintainer can create, or restore access to, an admin account from the repository in one step, without the app. This covers the first admin and recovery if every admin is locked out.

### Running and releasing it
- **FR15**: Everything the hosted app needs (the API, the pages, sign-in and the data) is defined in the repository's infrastructure code. Removing the stack never deletes the production data or the team's accounts by accident.
- **FR16**: The maintainer releases a new version of the pages and the API with one deploy. People already using the app pick up the new pages the next time they load the app.
- **FR17**: After a deploy, the maintainer can run one check that confirms the app is up, that every API route refuses requests without a sign-in, and that admin-only routes refuse a non-admin. It prints no cast data.
- **FR18**: Local development and the demo keep working with no sign-in and no AWS account, acting as a signed-in admin, so every page and admin action can be tried locally.
- **FR19**: The repository's maintainer guide covers deploying the hosted app, creating the first admin, the post-deploy check, releasing updates, rolling back to the previous version, and what to do if an admin is locked out.

## Non-functional requirements

- **Security**:
  - Sign-in is required from the first deploy that can reach any data (ADR 0010). Nothing is reachable "just for testing" without it.
  - Accounts store a username, password, admin flag and enabled flag. No email, phone or other personal detail. Only the sign-in service ever sees a permanent password. Temporary passwords are generated by our code, shown once to an admin or the maintainer, and never logged.
  - Proof of sign-in held by the browser expires within 1 hour (now 5 minutes: team-roles FR13) and is renewed, for up to 1 day, while the person is signed in.
  - Logs never include cast names, notes, passwords or proof of sign-in, and never record request or response bodies. They're kept for 30 days at most.
  - The stored files behind the pages are reachable only through the app's web address, never directly.
  - Pages are served with security headers that stop them being framed and limit where scripts can load from.
  - The API limits how many requests it accepts per second, so a misbehaving client or an attack can't run up the bill.
  - Each part has only the AWS permissions it needs. Only the user-management part can change accounts.
  - Data and accounts are stored only in the UK region. Requests pass through edge locations, but only the pages, which contain no data, are cached there.
  - No credentials, account ids or usernames in the repository.
- **Accessibility**: the sign-in, choose-a-new-password and user-management screens meet WCAG 2.2 AA and work at 320px wide, like the rest of the app.
- **Performance**: see goals. Saves complete in under 1.5 seconds on a UK 4G phone.
- **Cost**: pay-per-use only, with no always-on servers. Within the existing £5-a-month budget alert.
- **Reliability**: a bad release can be rolled back to the previous version by the maintainer in one deploy, without touching data or accounts.

## Constraints and assumptions

- **Constraints**:
  - ADR 0010 (personal data, access control before hosting), ADR 0006 (Lambda-shaped handlers), ADR 0015 (DynamoDB). ADRs 0017 (hosting) and 0018 (access control) record the decisions this PRD relies on.
  - Real cast data reaches the hosted API only after remote-data is finished: the data is copied and verified, and the local files are removed (remote-data E3), with the maintainer's guide in place (E4). The tools shipped 2026-10-17 (#45); the move itself is run by the maintainer before the hosted API serves real data.
  - Deploys are manual, from the maintainer's machine, each with their approval (CLAUDE.md).
  - The pages call the API on the same address under `/api`, as they do locally today.
- **Assumptions to validate**:
  - 5 to 20 team members, rarely more than 5 at once. The maintainer is the only admin at first. More can be made admin in the app later.
  - Team members are adults. Their usernames are chosen by admins and needn't be their real name.
  - One production (2027). Every signed-in team member can see it.
  - Signing in once a day is acceptable to the team.

## Delivery order

Each step is releasable on its own. Steps 3 to 6 can't serve real data without sign-in, because sign-in arrives with the first deploy in step 3.

1. **Finish remote-data E3 and E4** (copy, verify, remove the local files, maintainer's guide). Done 2026-10-17 (#45). The maintainer still runs the move for the real production before step 4 serves real data.
2. **Decisions and plan**: ADRs 0017 and 0018 accepted, this PRD approved, story map.
3. **Walking skeleton**: the API deployed with sign-in on every route from its first deploy, the bootstrap admin (FR14) and the post-deploy check (FR17). Serves the health route only.
4. **All API routes hosted** against the remote data, with the admin-only rule enforced by the API (FR9).
5. **The hosted pages**: pages at the app address with sign-in, first-login password change, sign-out and admin-only actions hidden (FR1, FR3, FR5 to FR8, FR10, FR16). This is the first time anyone but the maintainer can use the app.
6. **User management in the app** (FR11 to FR13), then the guide (FR19), then the first real accounts are handed out.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A route is reachable without sign-in through a mistake | L | H | Default-deny for every route (FR2), infrastructure tests, and the post-deploy check over every route (FR17). |
| All admins lose access (forgotten password, accidental disable) | M | M | FR13 stops self-lockout. The maintainer can restore an admin from the repo (FR14). That matters most while the maintainer is the only admin. |
| Team members share one account or password | M | M | Creating an account takes under 2 minutes (goal), so everyone gets their own. Disabling one account doesn't affect others. |
| A lost or stolen phone is signed in | M | M | Sign-in lasts at most 1 day (FR7). An admin can disable the account, ending access within 1 hour (FR12; now 5 minutes). |
| The provided sign-in screens are confusing or hard to use for non-technical volunteers | M | M | Try them with a team member during the walking skeleton. Switch to our own sign-in screen if needed (ADR 0018, "Revisit if"). |
| Guessing passwords | L | H | Lockout and slow-down (FR8), request rate limits, temporary passwords that must be changed. |
| The first request after a quiet spell is slow | M | L | Accepted within the 4-second goal. Measure it in the walking skeleton. |
| Hosting goes live before the data move is finished, so two copies drift apart | L | H | Delivery order: remote-data E3 and E4 first (constraint). |
| Sign-in service pricing changes | L | L | Budget alert. Usage is far inside free allowances today. |
| Leaked maintainer AWS credentials | L | H | Least-privilege profile and MFA (remote-data guide). |

## Open questions

- Resolved 2026-10-17: go-live is as soon as the delivery order allows, so each step ships as soon as it's ready, with no date to wait for. The maintainer is the first and only admin to begin with, created by the FR14 script (the username is given when the script is run, not committed). The health route stays behind sign-in like every other route.
- Resolved 2026-10-17: usernames are assigned by admins, with no email or phone and no self-service reset. Admins manage users in the app, delete cast members and save running orders. The address is the hosting's default one. Sign-in lasts 1 day.
