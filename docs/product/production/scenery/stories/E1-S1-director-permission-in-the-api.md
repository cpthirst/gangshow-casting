---
id: production-scenery.E1.S1
title: Add the Director permission to the API
epic: E1
status: ready
---

## Story

As the show's director, I want a permission that lets me change every production department but not casting, so that I can keep the props (and later scenery, sound, mics and wardrobe) up to date without being made an Admin.

## Acceptance criteria

### AC1: Director can change props
Given "dee" has the Director permission only
When dee adds a prop to "Opening Number", or saves its props notes
Then each change is saved, as it is for someone with Stage

### AC2: Stage can still change props
Given "pat" has the Stage permission only
When pat adds a prop, or saves props notes
Then each change is saved, as it is today

### AC3: Director can't change casting or the show
Given "dee" has the Director permission only
When dee adds a cast member, adds a role, casts someone, saves casting item notes or saves the running order
Then each is refused with 403 saying "You can view the casting, but not change it."
And nothing is changed

### AC4: Director can't do anything admin-only
Given "dee" has the Director permission only
When dee asks for the accounts, or sends any other admin-only request
Then it is refused with "Only admins can do this."

### AC5: Without Stage or Director, props changes are refused
Given "lee" has the Casting, Tech and Wardrobe permissions
When lee adds a prop
Then it is refused with 403 saying "You can view the props, but not change them."

### AC6: A change route can name more than one permission
Given the API's list of routes
When each route that isn't a read is checked
Then it names one or more permissions, any of which allows it, or is admin-only
And the props and props notes routes name Stage and Director

### AC7: Director combines with other permissions
Given "kim" has the Casting and Director permissions
When kim casts someone and adds a prop
Then both are saved

### AC8: An Admin's extra Director group is ignored
Given an Admin whose sign-in also carries the Director group
When they make any change
Then it is allowed as for any Admin, and the API treats them as an Admin only

### AC9: The props pages show their controls to a Director
Given "dee" has the Director permission only
When dee opens the props list for "Opening Number"
Then dee sees the controls someone with Stage sees, and no read-only line
And the casting pages still show the read-only view with "You can view the casting, but not change it."

### AC10: The Overview names a Director's buttons "Edit"
Given "dee" has the Director permission only
When dee reaches the buttons for "Opening Number" with a screen reader
Then the Scenery, Props, SFX, Mic plot and Wardrobe buttons are each named "Edit …"

### AC11: No existing account's access changes
Given "sam" has Casting, "pat" has Stage, "jo" has no permissions and "alex" is an Admin
When this change is deployed
Then each of them can change exactly what they could before
And none of them has the Director permission

## Notes

- FRs: FR1, FR2, FR4
- Depends on: none
- **ADR** (via the `adr` skill), amending ADR 0026: a new `director` user pool group, and a change route naming a list of permissions, any of which allows it, in place of exactly one. The table stays typed against the routes, and a route missing from it still needs an Admin.
- The new group is an infra change, so the infra review runs. Nobody is added to it on deploy (AC11).
- SFX, Mic plot and Wardrobe have no change routes yet. When each is built, its routes name its department and Director (FR2).
- Until E1.S2 an account with Director can only be made from the repository or the AWS console, for testing.
- Out of scope: the Accounts page tick box and the local switch (E1.S2), and scenery routes (E2.S1, E2.S7).
