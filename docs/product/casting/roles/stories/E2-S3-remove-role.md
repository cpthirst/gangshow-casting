---
id: casting-roles.E2.S3
title: Remove a role
epic: E2
status: ready
---

## Story

As an item leader, I want to remove a part that's been cut from an item, so that the item's roles match what's actually on stage.

## Acceptance criteria

### AC1: Removing asks first, naming the role
Given "Pirate Sketch" has a role "Parrot"
When I choose "Remove" on "Parrot"
Then I'm asked "Remove the role Parrot from Pirate Sketch? Anyone cast in it will be uncast."

### AC2: Confirming removes the role
Given I've been asked to confirm removing "Parrot"
When I confirm
Then "Parrot" is no longer listed
And reloading the page doesn't bring it back

### AC3: Cancelling keeps the role
Given I've been asked to confirm removing "Parrot"
When I cancel
Then "Parrot" is still listed

### AC4: Removing the last role shows the empty state
Given "Parrot" is the only role in "Pirate Sketch"
When I remove it
Then I see "No roles have been added yet."

### AC5: Removing a role someone else changed is refused
Given someone else has edited or removed "Parrot" since I opened "Pirate Sketch"
When I confirm removing "Parrot"
Then I'm told "Someone else changed this role. Showing the latest roles."
And the page shows the item's current roles

### AC6: The API removes a role and its casting
Given role 7 is at revision 2 and has cast member 12
When a client deletes role 7 with revision 2
Then the response is 204
And role 7 no longer appears anywhere in the stored roles

### AC7: The API refuses stale and unknown removals
Given role 7 is at revision 2
When a client deletes role 7 with revision 1, or deletes a role that doesn't exist
Then the response is 409 or 404 respectively, and nothing is removed

## Notes

- FRs: FR7, FR8 (stale removals refused)
- Depends on: casting-roles.E1.S1.
- Expected route: `DELETE /api/productions/{productionId}/roles/{roleId}?revision=N`.
- Permanent, with no history, because a role links a young person to a part (ADR 0010).
- Out of scope: undo.
