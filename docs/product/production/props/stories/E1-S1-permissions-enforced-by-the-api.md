---
id: production-props.E1.S1
title: Enforce department permissions in the API
epic: E1
status: done
---

## Story

As an admin, I want each account to have exactly the departments it works in, enforced by the API, so that the props team can keep props without being able to change casting, however they try.

## Acceptance criteria

### AC1: Casting permission keeps today's casting access
Given "sam" has the Casting permission only
When sam adds a cast member, edits a role or saves item notes
Then each change is saved as it is today
And sam's admin-only requests are still refused with "Only admins can do this."

### AC2: A change outside the account's permissions is refused
Given "pat" has the Stage permission only
When pat sends any casting change, for example adding a cast member, adding a role or saving item notes
Then the response is 403 saying "You can view the casting, but not change it."
And nothing is changed

### AC3: Every change route names its permission
Given the API's list of routes
When any route that isn't a read is checked
Then it names the permission it needs, or is admin-only
And a route that names neither is refused for everyone but admins before its handler runs

### AC4: No permissions means read-only
Given "jo" has no permissions
When jo asks for the running order, the cast, the roles or the item notes
Then each answers 200 with the same data an account with Casting gets
And any change jo sends is refused with 403 saying "You can view the casting, but not change it."

### AC5: Several permissions combine
Given "kim" has the Casting and Stage permissions
When kim sends a casting change
Then it is allowed, as for an account with Casting only

### AC6: Tech and Costume allow no change yet
Given "lee" has the Tech and Costume permissions only
When lee sends any change
Then it is refused with 403 saying "You can view the casting, but not change it."

### AC7: An admin keeps today's access
Given "alex" is an Admin
When alex makes any change, including an admin-only one
Then it is allowed as it is today

### AC8: Reads and usage stay open to everyone
Given "pat" has the Stage permission only
When pat downloads the Excel casting grid or records a page visit
Then both are allowed, as for every role today

### AC9: An unknown sign-in grants no more than reading
Given an account whose sign-in carries only groups the API doesn't recognise
When it sends a change
Then it is refused with 403 saying "You can view the casting, but not change it."

### AC10: Existing accounts keep exactly their access
Given before this change "sam" is a Casting Team Member, "jo" a Read-Only Team Member and "alex" an Admin
When the maintainer deploys and runs the repository's move of existing accounts
Then sam has Casting, jo has no permissions and alex is still an Admin
And none of them can change anything they couldn't before

### AC11: Moving accounts is safe to repeat
Given every account has already been moved
When the maintainer runs the move again
Then no account's access changes
And it says how many accounts it checked and how many it moved

## Notes

- FRs: FR1, FR2, FR4, FR5
- Depends on: none
- [ADR 0026](../../../../adr/0026-department-permissions-as-user-pool-groups.md) (accepted 2026-10-25) amends ADR 0020 and settles these: permissions per department replace "read-only may only read" for every route that isn't a read. It decides:
  - how permissions are held (for example user pool groups `casting`, `stage`, `tech`, `costume`);
  - what becomes of the `read-only` group, and whether it still overrides other groups, so a mistaken extra group can't widen access;
  - how each route names its permission in one place;
  - how existing accounts move, and whether anyone has to sign in again.
- The reads every role may use (every `GET`, the Excel export, recording usage: ADR 0021, ADR 0023) stay open to everyone.
- Until production-props.E2.S1, the Accounts page shows an account with Casting as "Casting Team Member" and one with no permissions as "Read-Only Team Member". An account with only Stage can be made from the repository, for testing.
- No props routes exist yet. The first one, which needs Stage, arrives with production-props.E4.S2.
- Out of scope: hiding controls on the pages (E1.S2), and choosing permissions in the app (E2).
