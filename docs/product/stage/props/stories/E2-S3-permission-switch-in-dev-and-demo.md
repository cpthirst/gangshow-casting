---
id: stage-props.E2.S3
title: Switch permissions in local development and the demo
epic: E2
status: ready
---

## Story

As the maintainer or a volunteer trying the demo, I want to try any mix of permissions without an account, so that I can see what a stage manager with Stage and Tech, or the casting team, each see and can do.

## Acceptance criteria

### AC1: It starts as an admin
Given `pnpm dev` or `pnpm demo` has just started
When I open the app
Then I'm an Admin, as today, and the switch shows "Admin"

### AC2: Switching to a mix of permissions changes the pages and the API
Given I'm in the demo as an Admin
When I switch to Stage and Tech
Then the casting pages show the read-only view
And the local API refuses my casting changes with "You can view the casting, but not change it."

### AC3: Switching to Casting
Given I'm in the demo
When I switch to Casting only
Then I can change casting but can't use admin-only actions, and Accounts isn't in the menu

### AC4: Switching to no permissions
Given I'm in the demo
When I untick every permission
Then every page shows the read-only view, and the local API refuses every change

### AC5: The switch is never in the hosted app
Given the app is the hosted build, signed in through the user pool
When any page is open
Then there is no switch, and no way to choose access other than the account's own

### AC6: The hosted API ignores any attempt to choose access
Given a request to the hosted API that tries to pick permissions the way the local switch does
When it arrives
Then the API uses only the signed-in account's own access

## Notes

- FRs: FR9
- Depends on: stage-props.E1.S1. It's most useful once the pages follow permissions (E1.S2).
- The switch replaces today's three-role "Local role" switch. It stays where it is in the sidebar, labelled as local and clear at a glance, with a labelled group for the permissions.
- Browser tests keep running as an admin unless a test switches.
