---
id: simplify.E5.S1
title: Keep a list of productions and open the newest
epic: E5
status: draft
---

## Story

As someone on the team, I want the app to open the newest production and show its year, so that I always know which show I'm working on once there's more than one.

## Acceptance criteria

### AC1: The ADR comes first
Given no decision yet on how the list of productions is held
When this story starts
Then an ADR, written with the `adr` skill, says how it's held, and the maintainer accepts it before any code changes

### AC2: Today's production is listed
Given the hosted app holds the 2027 production
When the list of productions is read
Then it holds 2027

### AC3: The app opens the newest
Given productions 2027 and 2028
When anyone signs in
Then the app shows the 2028 production's pages

### AC4: The production's year shows
Given someone has the 2028 production open
When they look at any page
Then the year 2028 shows in the sidebar

### AC5: Access is the same in every production
Given "pat" has Stage
When pat opens the 2028 production
Then pat can change the props and scenery and view the rest, as in 2027

### AC6: Signed out sees nothing
Given someone who isn't signed in
When they ask the API for the list of productions
Then the API refuses them

## Notes

- FRs: FR20, FR23
- Depends on: simplify.E4.S4
- Walking skeleton for Epic 5. AC3 can use a second production set up in the test; starting one comes in E5.S2.
- Every API route already takes the production in its address, so no existing route changes shape (PRD constraints).
- The sidebar's year is a new element: ask the maintainer whether the browser layout walks should check it (CLAUDE.md).
