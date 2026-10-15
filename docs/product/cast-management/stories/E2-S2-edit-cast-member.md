---
id: cast-management.E2.S2
title: Edit a cast member's details
epic: E2
status: in-progress
---

## Story

As a member of the production team, I want to correct a cast member's details, so that the list stays accurate as names, sections or groups change.

## Acceptance criteria

### AC1: Editing a cast member
Given "Sam Example" is a Scout in "1st Somewhere"
When I choose "Edit" for "Sam Example", change their section to "Explorers" and group to "Riverside ESU", and save
Then their row shows Explorers and "Riverside ESU"

### AC2: Every field but the ID can be edited
Given I'm editing "Sam Example"
When I look at the form
Then I can change first name, last name, section and group
And the ID is shown but can't be changed

### AC3: A renamed member moves to their new place in the list
Given "Sam Example" is listed before "Alex Sample"
When I change "Sam Example"'s last name to "Toms" and save
Then "Sam Toms" is listed after "Alex Sample"

### AC4: Invalid details aren't saved
Given I'm editing "Sam Example"
When I clear the first name and save
Then I see "Enter a first name" next to the field
And "Sam Example" is unchanged

### AC5: Cancelling leaves the member unchanged
Given I'm editing "Sam Example" and have changed the group
When I cancel
Then "Sam Example" is unchanged

### AC6: Someone else's change isn't overwritten
Given I opened the cast list, and someone else has since edited or deleted "Sam Example"
When I save my edit to "Sam Example"
Then my edit isn't saved
And I see "Someone else changed this cast member. Showing the latest list."
And the list shows the current details

### AC7: The API updates a cast member
Given cast member 12 is at revision 3
When a client puts valid details for member 12 with revision 3
Then the response is 200 with the updated member at revision 4

### AC8: The API refuses stale, unknown and invalid updates
Given cast member 12 is at revision 4
When a client puts details with revision 3, or for a member that doesn't exist, or with an empty last name or a changed ID
Then the response is 409, 404 or 400 respectively, and nothing is saved

## Notes

- FRs: FR4, FR6, FR7
- Depends on: cast-management.E2.S1. It reuses the cast member form.
- Expected route: `PUT /api/productions/{productionId}/cast/{castId}` with the member's details and the revision it was based on. The ID comes from the path, never from the body.
- Out of scope: editing several members at once.
