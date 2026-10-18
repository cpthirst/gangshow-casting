---
id: team-roles.E3.S2
title: Choose a role for a new account
epic: E3
status: ready
---

## Story

As an admin adding a reviewer, I want to pick their role when I create their account, so that they get the right access from their very first sign-in.

## Acceptance criteria

### AC1: The new account's role defaults to read-only
Given an admin opens the Add account form
When they look at the role
Then "Read-Only Team Member" is already chosen

### AC2: An admin can choose any role
Given an admin is adding the account "jo"
When they choose "Casting Team Member" and add the account
Then jo is listed as a Casting Team Member, with the temporary password shown once as today

### AC3: A read-only account is created as read-only
Given an admin adds the account "jo" without changing the role
When jo's account is listed
Then jo is a Read-Only Team Member

### AC4: A new read-only member signs in like anyone else
Given "jo" was just added as a Read-Only Team Member
When jo signs in with the temporary password
Then jo must choose a new password first
And then sees the show read-only

### AC5: The API refuses an unknown role
Given an admin's client sends a new account with a role that isn't one of the three
When the request arrives
Then the response is 400 and no account is created

## Notes

- FRs: FR8, FR9
- Depends on: team-roles.E3.S1
- The role choice in the Add account form looks the same as on the account rows (E3.S1).
- Out of scope: changing a role later (E3.S1).
