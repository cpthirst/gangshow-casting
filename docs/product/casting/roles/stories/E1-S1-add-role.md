---
id: casting-roles.E1.S1
title: Add an uncast role to an item
epic: E1
status: ready
---

## Story

As a member of the production team in a casting meeting, I want to add a role to an item with its name and size, so that the item's parts are recorded as soon as we decide them, even before anyone is cast.

## Acceptance criteria

### AC1: Adding a role
Given I'm on the "Pirate Sketch" page and it has no roles
When I choose "Add role", enter role name "Captain Hook", choose role size "Lead", and save
Then "Captain Hook" is listed on the page with its size "Lead"
And "No roles have been added yet." is no longer shown

### AC2: Added roles are kept
Given I've added "Captain Hook" to "Pirate Sketch"
When I reload the page
Then "Captain Hook" is still listed

### AC3: Roles belong to their item
Given I've added "Captain Hook" to "Pirate Sketch"
When I open the "Campfire Song" page
Then "Captain Hook" is not listed

### AC4: A role name is required
Given I'm adding a role
When I leave the role name empty, or enter only spaces, and save
Then I see "Enter a role name" next to the field
And no role is added

### AC5: Long role names are refused
Given I'm adding a role
When I enter a role name of 61 characters and save
Then I see "Role names can be up to 60 characters" next to the field
And no role is added

### AC6: A role size is required
Given I'm adding a role
When I enter role name "Captain Hook" but choose no size, and save
Then I see "Choose a role size" next to the field
And no role is added

### AC7: Cancelling adds nothing
Given I've started adding a role and typed a name
When I cancel
Then no role is added

### AC8: The API adds a role
Given "pirate-sketch" is in the latest saved running order
When a client posts role name "Captain Hook" and size "lead" for item "pirate-sketch"
Then the response is 201 with the new role, an app-assigned ID, no cast members and revision 1

### AC9: The API refuses invalid roles and unknown items
Given "pirate-sketch" is in the latest saved running order and "no-such-item" isn't
When a client posts a role with no name or an unknown size for "pirate-sketch", or a valid role for "no-such-item"
Then the response is 400 or 404 respectively, and nothing is stored

## Notes

- FRs: FR1 (name and size), FR3 (required and length checks), FR8 (saves straight away)
- Depends on: casting-item-overview.E1.S1.
- Walking skeleton: shared role schema → roles store (local file `apps/api/data/<productionId>/roles.json`, plus in-memory for tests) → API → form on the item page.
- Expected routes: `GET /api/productions/{productionId}/roles` (every role in the production) and `POST /api/productions/{productionId}/items/{itemId}/roles`.
- The role name is trimmed before checking. Up to 60 characters is the PRD's assumption.
- Roles are shown as a plain list (name and size) until casting-item-overview.E2.S1 turns them into cards.
- Out of scope: duplicate names (E1.S2), casting someone (E1.S3).
