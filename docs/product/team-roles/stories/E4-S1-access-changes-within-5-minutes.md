---
id: team-roles.E4.S1
title: Make access changes take effect within 5 minutes
epic: E4
status: ready
---

## Story

As an admin, I want a role change, a disabled account or a password reset to take effect within minutes, so that someone moved to read-only, or locked out, can't keep editing for an hour.

## Acceptance criteria

### AC1: A role change reaches every device within 5 minutes
Given "sam" is a Casting Team Member signed in on a phone
When an admin makes sam a Read-Only Team Member
Then within 5 minutes the API refuses sam's changes with "You have read-only access."
And sam doesn't have to sign in again by hand to be treated as read-only

### AC2: A disabled account stops working within 5 minutes
Given "sam" is signed in
When an admin disables sam's account
Then within 5 minutes every request sam makes is refused, on every device

### AC3: A password reset ends access within 5 minutes
Given "sam" is signed in
When an admin resets sam's password
Then within 5 minutes sam's old sign-in no longer works on any device

### AC4: People stay signed in for the day
Given "jo" signed in this morning and keeps the app open
When jo uses it through the afternoon
Then jo isn't asked to sign in again before the day's sign-in ends, and no request fails while the sign-in is renewed

### AC5: The page catches up with a new role
Given "sam" has the Running order open as a Casting Team Member
When an admin makes sam a Read-Only Team Member and sam's sign-in renews
Then sam's page hides the editing controls and shows "You have read-only access" without a reload

### AC6: A refused change says why
Given "sam" was made a Read-Only Team Member while editing an item's notes
When sam presses Save
Then sam sees "You have read-only access, so this wasn't saved."
And the page shows the read-only view

## Notes

- FRs: FR12, FR13
- Depends on: team-roles.E3.S1
- This tightens hosting FR12 (1 hour → 5 minutes) for disabling and resets too. Update the hosting PRD and ADR 0018's token lifetimes when this is built.
- Agreed approach (2026-10-18): shorten the sign-in tokens to Cognito's 5-minute minimum. Pages already renew sign-ins before they expire. There is no per-request role lookup.
- Out of scope: anything faster than 5 minutes.
