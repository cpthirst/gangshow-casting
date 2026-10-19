---
id: team-roles.E5.S2
title: Switch roles in local development and the demo
epic: E5
status: done
---

## Story

As the maintainer or a volunteer trying the demo, I want to switch between the three roles without an account, so that I can see exactly what an Admin, a Casting Team Member and a Read-Only Team Member each see and can do.

## Acceptance criteria

### AC1: It starts as an admin
Given `pnpm dev` or `pnpm demo` has just started
When I open the app
Then I'm an Admin, as today, and the switch shows "Admin"

### AC2: Switching to read-only changes the pages and the API
Given I'm in the demo as an Admin
When I switch to "Read-Only Team Member"
Then the pages show the read-only view
And the local API refuses my changes with "You have read-only access."

### AC3: Switching to Casting Team Member
Given I'm in the demo
When I switch to "Casting Team Member"
Then I can change casting but not use admin-only actions, and Accounts isn't in the menu

### AC4: The switch is never in the hosted app
Given the app is the hosted build, signed in through the user pool
When any page is open
Then there is no role switch, and no way to choose a role other than the account's own

### AC5: The hosted API ignores any attempt to choose a role
Given a request to the hosted API that tries to pick a role the way the local switch does
When it arrives
Then the API uses only the signed-in account's own role

## Notes

- FRs: FR16
- Depends on: team-roles.E1.S1. It's most useful once the read-only pages (E2) are built.
- The switch sits where the signed-in account's name is shown, labelled as the local role, and is clear at a glance.
- Browser tests keep running as an admin unless a test switches.
- Out of scope: switching between accounts or usernames.
