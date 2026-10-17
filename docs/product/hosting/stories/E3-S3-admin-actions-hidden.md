---
id: hosting.E3.S3
title: Show admin-only actions only to admins
epic: E3
status: done
---

## Story

As a production team member who isn't an admin, I want the app to show me only what I can do, so that I don't try an action and get an error.

## Acceptance criteria

### AC1: A non-admin doesn't get delete on a cast member
Given a signed-in team member who isn't an admin
When they open the Cast list
Then each cast member's delete button is disabled
And it says "Only admins can delete cast members"

### AC2: A non-admin can't save the running order
Given a signed-in team member who isn't an admin
When they open the running order
Then they can see it
And the save action is disabled with "Only admins can change the running order"

### AC3: An admin sees both actions
Given a signed-in admin
When they open the Cast list and the running order
Then delete and save work as they do today

### AC4: An unexpected refusal is explained
Given a non-admin whose page still offers an admin action (for example, after their admin role was removed)
When the API refuses it with 403
Then the page says only admins can do this
And nothing on the page changes

## Notes

- FRs: FR10
- Depends on: hosting.E3.S2, hosting.E2.S2
- Whether someone is an admin comes from their sign-in (ADR 0018), not from a separate request.
- The ux-reviewer should check that the disabled and hidden states match the rest of the app.
- Out of scope: user management pages (E4).
- AC1 changed during the build (2026-10-18, the user's choice): delete is the bin icon on each row of the Cast list, not on the edit form, so it's shown disabled with the reason as its tooltip, matching AC2's disabled-with-reason save.
- Locally (`pnpm dev`, `pnpm demo`) everyone acts as an admin (E3.S2 AC8), so both actions work as before.
