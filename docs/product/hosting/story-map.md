---
feature: hosting
status: approved
prd: ./prd.md
---

# Hosting: story map

## Epics

| Epic | Capability | FRs |
|---|---|---|
| E1 | A hosted API that refuses anyone not signed in, from its first deploy | FR2, FR14, FR15, FR17 |
| E2 | Every API route hosted on the remote data, with admin-only actions enforced | FR2, FR9, FR15, FR17, FR18 |
| E3 | The team signs in and uses the app in a browser, from anywhere | FR1, FR3, FR4, FR5, FR6, FR7, FR8, FR10, FR15, FR16, FR18 |
| E4 | Admins manage accounts in the app | FR9, FR11, FR12, FR13, FR18 |
| E5 | A maintainer's guide to running the hosted app | FR19 |

## E1: A hosted API that refuses anyone not signed in, from its first deploy

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [hosting.E1.S1](stories/E1-S1-signed-in-only-health-route.md) | Walking skeleton: the health route deployed on Lambda behind an HTTP API, with a retained username-only user pool and its authorizer on every route; a post-deploy check confirms no-token requests get 401 | FR2, FR15, FR17 | (none) | done |
| [hosting.E1.S2](stories/E1-S2-first-admin-from-the-repo.md) | The maintainer creates, or restores, an admin account in one step from the repo; the post-deploy check signs in as a check account and gets 200 | FR14, FR17 | E1.S1 | done |

## E2: Every API route hosted on the remote data, with admin-only actions enforced

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [hosting.E2.S1](stories/E2-S1-all-routes-hosted.md) | Every route in the routes list is hosted against the remote table, sign-in required on each; the check covers every route | FR2, FR15, FR17 | E1.S2 | done |
| [hosting.E2.S2](stories/E2-S2-admin-only-actions.md) | Deleting a cast member and saving a running-order version are refused (403) for non-admins; the local dev server and demo act as an admin; the check confirms a non-admin is refused | FR9, FR17, FR18 | E2.S1 | done |

## E3: The team signs in and uses the app in a browser, from anywhere

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [hosting.E3.S1](stories/E3-S1-pages-at-one-address.md) | The pages are served at one HTTPS address, with `/api` routed to the hosted API, no caching of API responses, security headers, and new releases picked up on next load; without sign-in no data shows | FR1, FR3, FR4, FR15, FR16 | E2.S1 | ready |
| [hosting.E3.S2](stories/E3-S2-sign-in-and-out.md) | Sign in with an assigned username, choose a new password at first sign-in, stay signed in for a day, sign out; wrong-password errors don't say which part was wrong; local dev stays signed in as an admin | FR3, FR5, FR6, FR7, FR8, FR18 | E3.S1 | ready |
| [hosting.E3.S3](stories/E3-S3-admin-actions-hidden.md) | Non-admins don't see delete-cast-member or save-running-order, or see them disabled with "Only admins can …" | FR10 | E3.S2, E2.S2 | ready |

## E4: Admins manage accounts in the app

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [hosting.E4.S1](stories/E4-S1-list-and-create-accounts.md) | An admin sees every account (username, admin, disabled) and creates one with a username and temporary password; refused for non-admins; works locally against an in-memory directory | FR9, FR11, FR18 | E3.S2, E2.S2 | ready |
| [hosting.E4.S2](stories/E4-S2-reset-and-disable-accounts.md) | An admin resets an account's password or disables and re-enables it, ending its access on every device within 1 hour; an admin can't disable themselves | FR11, FR12, FR13 | E4.S1 | ready |
| [hosting.E4.S3](stories/E4-S3-grant-and-remove-admin.md) | An admin makes an account an admin or removes admin; an admin can't remove their own admin role, so one admin always remains | FR11, FR13 | E4.S1 | ready |

## E5: A maintainer's guide to running the hosted app

| ID | Story | FRs | Depends on | Status |
|---|---|---|---|---|
| [hosting.E5.S1](stories/E5-S1-hosting-guide.md) | Step-by-step guide: deploy, create the first admin, run the post-deploy check, release, roll back, recover a locked-out admin | FR19 | E1.S2, E3.S2, E4.S3 | ready |

## FR coverage

| FR | Stories |
|---|---|
| FR1 | E3.S1 |
| FR2 | E1.S1, E2.S1 |
| FR3 | E3.S1, E3.S2 |
| FR4 | E3.S1 |
| FR5 | E3.S2 |
| FR6 | E3.S2 |
| FR7 | E3.S2 |
| FR8 | E3.S2 |
| FR9 | E2.S2, E4.S1 |
| FR10 | E3.S3 |
| FR11 | E4.S1, E4.S2, E4.S3 |
| FR12 | E4.S2 |
| FR13 | E4.S2, E4.S3 |
| FR14 | E1.S2 |
| FR15 | E1.S1, E2.S1, E3.S1 |
| FR16 | E3.S1 |
| FR17 | E1.S1, E1.S2, E2.S1, E2.S2 |
| FR18 | E2.S2, E3.S2, E4.S1 |
| FR19 | E5.S1 |
