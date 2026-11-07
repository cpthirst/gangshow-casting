---
id: simplify.E3.S4
title: Hide controls that can never work for this person
epic: E3
status: done
---

## Story

As someone on the team, I want controls I can never use left out, rather than shown disabled with a line explaining why, so that the page only shows what I can do.

## Acceptance criteria

### AC1: An admin's own account has no access or Disable controls
Given "admin1" is an admin
When admin1 opens the Accounts page
Then their own row has no access controls and no Disable button
And the lines "You can't change your own access" and "You can't disable your own account" no longer show

### AC2: Other accounts keep their controls
Given "admin1" is an admin and "pat" is another account
When admin1 opens the Accounts page
Then pat's row has its access controls and Disable button, as today

### AC3: Only admins see Delete on the Cast page
Given "sam" has Casting but isn't an admin
When sam opens the Cast page
Then no Delete button shows on any cast member
And the line "Only admins can delete cast members" no longer shows

### AC4: The admin still deletes
Given an admin
When they open the Cast page
Then each cast member has its Delete button, as today

### AC5: Non-admins see the running order view only
Given "sam" has Casting but isn't an admin
When sam opens the Running order page
Then the page shows the "View only" badge, with no Save, Reset, Add item, Remove, Edit, Move or drag controls
And the line "Only admins can save the running order, or add and remove items" no longer shows

### AC6: The admin still changes the running order
Given an admin
When they open the Running order page
Then there is no "View only" badge, and they can move, drag, edit, add, remove, reset and save, as today

### AC7: The Running order's Help says only admins can change it
Given anyone signed in
When they open the Running order's Help
Then it says "Only admins can change the running order."
And every action that changes the running order is labelled "Admins only"

## Notes

- FRs: FR12 (and FR10, FR13 for the Running order's badge and Help)
- Depends on: simplify.E3.S2 (the badge on the Running order page)
- The maintainer chose to include the Running order page (2026-11-07).
- "Add all cast" when everyone is already in a role isn't included: it can work again once someone leaves a role, so it isn't a control that can never work.
- Decided (2026-11-07, for the maintainer to confirm): who may change a page is said once, in its Help entry, as a department or "admins"; the badge and the who-can-change line both read it. The Running order is the one page only admins change, so its line is "Only admins can change the running order."
- Decided: Casting members lose moving, editing and Reset on the Running order too, not just Save, Add and Remove. Changes they couldn't save were the confusing part, and the API already refuses their saves, so nothing changes in the API.
- Decided: an admin's own row keeps Reset password; only the access and Disable buttons go.
- The refusal alerts stay ("Only admins can delete cast members." and "Only admins can change the running order."): they show if an admin loses their role after signing in (team-roles FR12).
