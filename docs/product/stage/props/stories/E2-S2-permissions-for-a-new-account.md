---
id: stage-props.E2.S2
title: Choose permissions for a new account
epic: E2
status: done
---

## Story

As an admin, I want to choose a new account's departments as I create it, so that a new props volunteer can start work straight away with only the access they need.

## Acceptance criteria

### AC1: A new account starts with no permissions
Given an admin opens the new account form
When they look at its access
Then Admin and every permission are unticked, and it says the account will be read-only

### AC2: An admin creates an account with chosen permissions
Given an admin is creating the account "pat"
When they tick Stage and Tech and create it
Then pat appears on the Accounts page showing "Stage, Tech"
And the temporary password is shown once, as today

### AC3: An admin creates a read-only account
Given an admin is creating the account "jo"
When they tick nothing and create it
Then jo shows "Read-only"

### AC4: An admin creates another admin
Given an admin is creating the account "chris"
When they choose Admin and create it
Then chris shows "Admin"

### AC5: The new account signs in with its permissions
Given "pat" was created with Stage
When pat signs in for the first time and chooses a new password
Then pat can view every page and change nothing outside Stage

### AC6: The API refuses an unknown permission
Given a request to create an account
When it names a permission that doesn't exist
Then the response is 400, and no account is created

## Notes

- FRs: FR6
- Depends on: stage-props.E2.S1
- The same labelled tick-box group as E2.S1.
- Creating an account replaces today's choice of one role, which defaults to Read-Only Team Member (team-roles.E3.S2).
- Out of scope: changing permissions later (E2.S1).
