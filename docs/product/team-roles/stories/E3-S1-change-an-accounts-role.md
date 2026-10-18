---
id: team-roles.E3.S1
title: Change an account's role
epic: E3
status: ready
---

## Story

As an admin, I want to see each person's role and change it in one step, so that the right people can edit casting and reviewers can only look.

## Acceptance criteria

### AC1: Each account shows its role by name
Given "alex" is an Admin, "sam" a Casting Team Member and "jo" a Read-Only Team Member
When an admin opens the Accounts page
Then the Role column shows "Admin", "Casting Team Member" and "Read-Only Team Member" respectively
And "Team member" no longer appears anywhere in the app

### AC2: An admin changes a role, confirming first
Given "sam" is a Casting Team Member
When an admin chooses "Read-Only Team Member" for sam
Then they are asked "Make sam a Read-Only Team Member? They'll be signed out on every device, and can only view the show when they sign back in."
And when they confirm, sam's role shows "Read-Only Team Member"

### AC3: Every role can be given
Given "jo" is a Read-Only Team Member
When an admin makes jo a Casting Team Member, and then an Admin
Then each confirmation says what jo will be able to do in that role
And jo's role shows the new one after each

### AC4: Cancelling changes nothing
Given "sam" is a Casting Team Member
When an admin chooses "Admin" for sam and then cancels the confirmation
Then sam is still a Casting Team Member
And sam isn't signed out

### AC5: The person is signed out on every device
Given "sam" is signed in on two devices
When an admin changes sam's role
Then both of sam's sign-ins end, as making someone an admin does today

### AC6: An admin can't change their own role
Given "alex" is the admin signed in
When alex looks at their own account
Then the role can't be changed, and it says "You can't change your own role"
And the API refuses a change to alex's own role with 409

### AC7: The last admin stays an admin
Given "alex" is the only enabled admin
When another account's request tries to change alex's role
Then it is refused, and alex stays an Admin

### AC8: Only admins can change roles
Given "sam" is a Casting Team Member
When sam sends a request to change any account's role
Then the response is 403 and no role changes

## Notes

- FRs: FR4, FR10, FR11, FR14
- Depends on: team-roles.E1.S1
- The one role choice replaces the Make admin and Remove admin buttons. It looks and behaves like the Accounts page's other actions, with a visible label (accessibility NFR).
- The role change replaces today's set-admin request in the API contract.
- The confirmation's wording also updates today's make-admin message, which says what admins can do.
- Out of scope: choosing a role when creating an account (E3.S2), and the change reaching other devices within 5 minutes (E4.S1). Until then it takes effect within the current sign-in lifetime.
