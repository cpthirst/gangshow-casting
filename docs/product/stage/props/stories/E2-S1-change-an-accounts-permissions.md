---
id: stage-props.E2.S1
title: Change an account's permissions
epic: E2
status: done
---

## Story

As an admin, I want to see and change which departments each person works in, so that a stage manager can have Stage and Tech without being able to change casting.

## Acceptance criteria

### AC1: Each account shows its access
Given "alex" is an Admin, "sam" has Casting, "kim" has Stage and Tech, and "jo" has no permissions
When an admin opens the Accounts page
Then alex shows "Admin", sam "Casting", kim "Stage, Tech" and jo "Read-only"

### AC2: An admin changes permissions, confirming first
Given "kim" has Stage and Tech
When an admin ticks Casting for kim and saves
Then they're asked to confirm, in words that say what kim will be able to change: casting, and the Stage and Tech pages
And it says kim will be signed out on every device
And when they confirm, kim shows "Casting, Stage, Tech"

### AC3: Removing every permission makes an account read-only
Given "sam" has Casting only
When an admin unticks Casting and confirms
Then the confirmation says sam will only be able to view the show
And sam shows "Read-only"

### AC4: An admin can make an account an Admin, or stop it being one
Given "sam" has Casting
When an admin makes sam an Admin and confirms
Then the confirmation says what admins can do, and sam shows "Admin"
And when an admin later gives sam Casting and Stage instead, sam shows "Casting, Stage"

### AC5: Cancelling changes nothing
Given "kim" has Stage
When an admin ticks Casting for kim and then cancels the confirmation
Then kim still has Stage only, and isn't signed out

### AC6: The person is signed out on every device
Given "kim" is signed in on two devices
When an admin changes kim's permissions
Then both of kim's sign-ins end, as a role change does today

### AC7: An admin can't change their own access
Given "alex" is the admin signed in
When alex looks at their own account
Then its access can't be changed, and it says "You can't change your own access"
And the API refuses a change to alex's own access with 409

### AC8: The last admin stays an admin
Given "alex" is the only enabled admin
When a request tries to give alex permissions instead of Admin
Then it is refused, and alex stays an Admin

### AC9: Only admins can change access
Given "sam" has Casting
When sam sends a request to change any account's access
Then the response is 403, and no access changes

### AC10: The app uses the permission names
Given the app after this change
When anyone reads the Accounts page, its confirmations or the app's access messages
Then they name Admin, Casting, Stage, Tech, Costume or Read-only
And "Casting Team Member" and "Read-Only Team Member" no longer appear as role names

## Notes

- FRs: FR6, FR7, FR8
- Depends on: stage-props.E1.S1
- The tick boxes form a labelled group (accessibility NFR). The change is saved in one step, with one confirmation.
- The access change replaces today's role change in the API contract.
- Out of scope: choosing permissions for a new account (E2.S2).
