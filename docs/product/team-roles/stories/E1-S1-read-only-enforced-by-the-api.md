---
id: team-roles.E1.S1
title: Enforce the three roles in the API
epic: E1
status: done
---

## Story

As an admin, I want the API to know who is a Casting Team Member and who is a Read-Only Team Member, so that a reviewer can never change casting, however they try.

## Acceptance criteria

### AC1: A read-only member can read everything
Given "jo" is a Read-Only Team Member
When jo asks the API for the running order, the cast, the roles, or the item notes
Then each answers 200 with the same data a Casting Team Member gets

### AC2: A read-only member can't change anything
Given "jo" is a Read-Only Team Member
When jo sends any request that changes data, for example adding a cast member, saving item notes, adding a role or saving a running-order draft
Then the response is 403 saying "You have read-only access."
And nothing is changed

### AC3: Every change route is refused, including new ones
Given the API's list of routes
When any route that isn't a read is called as a Read-Only Team Member
Then it is refused with 403 before its handler runs

### AC4: A Casting Team Member keeps today's access
Given "sam" is a Casting Team Member
When sam adds a cast member, edits a role or saves item notes
Then each change is saved as it is today
And sam's admin-only requests are still refused with "Only admins can do this."

### AC5: An admin keeps today's access
Given "alex" is an Admin
When alex makes any change, including an admin-only one
Then it is allowed as it is today

### AC6: An account with no recognisable role is read-only
Given an account that is in neither the Casting Team Member nor the Admin role
When it sends a request that changes data
Then the response is 403 saying "You have read-only access."

### AC7: Existing team members become Casting Team Members
Given "sam" is a non-admin team member before this change
When the maintainer deploys and then moves existing accounts to their roles from the repository
Then sam is a Casting Team Member
And once sam's sign-in renews, within the hour, sam can change casting again without being asked to sign in

### AC8: Moving accounts is safe to repeat
Given every non-admin account is already a Casting Team Member
When the maintainer moves existing accounts to their roles again
Then no account's role changes
And it says how many accounts it checked and how many it moved

## Notes

- FRs: FR1, FR2, FR3, FR7
- Depends on: none
- ADR 0020 (amends ADR 0018): roles are user pool groups (`admin`, `casting`, `read-only`), and no group means read-only. It's one release, with the move run straight after the deploy. Until an existing member's sign-in renews, within an hour, they are read-only; the maintainer accepted this gap (2026-10-18).
- Accounts created in the app join Casting Team Member, as today, until team-roles.E3.S2 lets admins choose.
- "A change" means every route that isn't a read (`GET`). Admin-only routes stay admin-only.
- Local dev, the demo and the browser tests still act as an admin (hosting FR18). Trying other roles locally is team-roles.E5.S2.
- Out of scope: hiding controls on the pages (E2), and choosing or changing roles in the app (E3). Until E3, a read-only account can only be made from the repository, for testing.
