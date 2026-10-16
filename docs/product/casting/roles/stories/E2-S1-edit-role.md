---
id: casting-roles.E2.S1
title: Edit a role
epic: E2
status: done
---

## Story

As an item leader after a rehearsal, I want to change a role's name, size or who plays it, so that the item's casting keeps up as the item develops.

## Acceptance criteria

### AC1: Casting someone in an uncast role
Given "Parrot" in "Pirate Sketch" is uncast
When I choose "Edit" on "Parrot", choose "Alex Sample" as the cast member and save
Then the "Parrot" card shows "Alex Sample"

### AC2: Recasting a role
Given "Captain Hook" is played by "Sam Example"
When I edit "Captain Hook", choose "Jo Newcomer" instead and save
Then the "Captain Hook" card shows "Jo Newcomer"

### AC3: Making a role uncast
Given "Captain Hook" is played by "Sam Example"
When I edit "Captain Hook", clear the cast member and save
Then the "Captain Hook" card shows "Uncast"

### AC4: Renaming and resizing a role
Given "Smee" is a support role
When I edit "Smee", rename it "Mr Smee", change its size to "Lead" and save
Then "Mr Smee" is listed among the leads, in alphabetical order

### AC5: Edits are checked like new roles
Given "Pirate Sketch" has roles "Captain Hook" and "Smee"
When I edit "Smee" and clear its name, or rename it "captain hook", and save
Then I see the same messages as when adding a role
And "Smee" is unchanged

### AC6: Cancelling leaves the role unchanged
Given I'm editing "Smee" and have changed its name
When I cancel
Then "Smee" is unchanged

### AC7: Someone else's edit isn't overwritten
Given I opened "Pirate Sketch", and someone else has since edited "Smee"
When I save my edit to "Smee"
Then my edit isn't saved
And I see "Someone else changed this role. Showing the latest roles."
And the page shows "Smee" as they left it

### AC8: Editing a role someone else removed
Given I opened "Pirate Sketch", and someone else has since removed "Smee"
When I save my edit to "Smee"
Then I see "Someone else changed this role. Showing the latest roles."
And "Smee" is no longer listed

### AC9: The API updates a role
Given role 7 is at revision 2
When a client puts a valid name, size and cast members for role 7 with revision 2
Then the response is 200 with the updated role at revision 3

### AC10: The API refuses stale and unknown updates
Given role 7 is at revision 2
When a client updates role 7 with revision 1, or updates a role that doesn't exist
Then the response is 409 or 404 respectively, and nothing changes

### AC11: The API refuses invalid updates
Given role 7 is a lead at revision 2
When a client updates role 7 with no name, a name another role in the item uses, or cast members [12, 13]
Then the response is 400 and nothing changes

## Notes

- FRs: FR4, FR8 (stale edits refused)
- Depends on: casting-roles.E1.S3 (reuses its form and cast member search).
- Expected route: `PUT /api/productions/{productionId}/roles/{roleId}`.
- Each role carries a revision that goes up on every change, as cast members do.
- For an ensemble role, this story edits name and size only. Its members are edited in E2.S2.
- Out of scope: changing which item a role belongs to.
