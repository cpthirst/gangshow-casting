---
id: hosting.E4.S3
title: Make an account an admin, or remove admin
epic: E4
status: ready
---

## Story

As an admin, I want to make another team member an admin or take it away, so that more than one person can manage the show and its accounts.

## Acceptance criteria

### AC1: Make an account an admin
Given "sam" isn't an admin
When an admin makes "sam" an admin
Then the list shows "sam" as an admin
And after "sam" next signs in they can use admin-only actions

### AC2: Remove admin
Given "sam" is an admin
When another admin removes admin from "sam"
Then the list shows "sam" as not an admin
And within 1 hour the API refuses "sam"'s admin-only actions

### AC3: An admin can't remove their own admin role
Given the signed-in admin is "pat"
When "pat" tries to remove admin from "pat"
Then they're told they can't remove their own admin role
And "pat" stays an admin

### AC4: There's always an admin
Given "pat" is the only enabled admin
When any change is attempted through the app
Then "pat" stays an enabled admin

### AC5: Non-admins can't change roles
Given a signed-in team member who isn't an admin
When they try to make anyone an admin, including themselves, through the API
Then the response is 403

## Notes

- FRs: FR11, FR13
- Depends on: hosting.E4.S1
- Admin is membership of the `admin` group (ADR 0018). Removing admin also signs that account out everywhere, so the change takes effect within the access-token lifetime.
- AC4 follows from AC3 and E4.S2 AC5 (only admins act, and no admin can disable or demote themselves). Test it as a combination.
- Out of scope: other roles or per-production permissions.
