---
id: hosting.E2.S2
title: Keep deleting cast members and saving the running order for admins
epic: E2
status: done
---

## Story

As an admin, I want only admins to be able to delete a cast member or change the running order, so that permanent or show-wide changes can't be made by mistake.

## Acceptance criteria

### AC1: A non-admin can't delete a cast member
Given a signed-in team member who isn't an admin
And a cast member "Alex Example" in production 2027
When they request to delete "Alex Example"
Then the response is 403 with a message saying only admins can do this
And "Alex Example" is still in the cast

### AC2: A non-admin can't save a running-order version
Given a signed-in team member who isn't an admin
And the latest running order for production 2027 is version 4
When they save a new running-order version
Then the response is 403
And the latest version is still 4

### AC3: An admin can delete a cast member
Given a signed-in admin
And a cast member "Alex Example" in production 2027
When they request to delete "Alex Example"
Then "Alex Example" is no longer in the cast

### AC4: An admin can save a running-order version
Given a signed-in admin
And the latest running order for production 2027 is version 4
When they save a new version from version 4
Then the latest version is 5

### AC5: Other changes stay open to every team member
Given a signed-in team member who isn't an admin
When they add a cast member "Jo Sample"
Then "Jo Sample" is in the cast
And of the routes that exist today, only deleting a cast member and saving a running-order version refuse non-admins

### AC6: Locally everyone is an admin
Given the app running with `pnpm dev` or `pnpm demo`
When a cast member is deleted or a running order is saved
Then the change is made with no sign-in

### AC7: The check confirms a non-admin is refused
Given a non-admin check account
When the maintainer runs the post-deploy check with it
Then it reports a pass only if each admin-only route returns 403 for that account
And it changes no data

## Notes

- FRs: FR9, FR17, FR18
- Depends on: hosting.E2.S1
- ADR 0018: routes are marked admin-only in the routes list, and the entry point refuses them before the handler runs. A new admin-only route can't forget the check.
- For AC7, the check can send requests that would be refused before any change. It must never send an admin-only request as an admin.
- Out of scope: hiding these actions in the pages (E3.S3), user management routes (E4).
