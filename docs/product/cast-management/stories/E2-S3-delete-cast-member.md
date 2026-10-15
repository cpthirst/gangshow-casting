---
id: cast-management.E2.S3
title: Delete a cast member
epic: E2
status: done
---

## Story

As a member of the production team, I want to remove someone who has left the show, so that the list only holds current cast and we don't keep their details longer than needed.

## Acceptance criteria

### AC1: Deleting asks first, naming the person
Given "Sam Example" is on the cast list
When I choose "Delete" for "Sam Example"
Then I'm asked "Delete Sam Example from the cast? This can't be undone."

### AC2: Confirming removes them for good
Given I've been asked to confirm deleting "Sam Example"
When I confirm
Then "Sam Example" is no longer on the list
And the count goes down by one
And reloading the page doesn't bring them back

### AC3: Cancelling keeps them
Given I've been asked to confirm deleting "Sam Example"
When I cancel
Then "Sam Example" is still on the list

### AC4: Deleting someone already changed or removed by someone else
Given someone else has edited or deleted "Sam Example" since I opened the list
When I confirm deleting "Sam Example"
Then I'm told "Someone else changed this cast member. Showing the latest list."
And the list shows the current cast

### AC5: The API deletes a cast member's data
Given cast member 12 is at revision 4
When a client deletes member 12 with revision 4
Then the response is 204
And member 12's details no longer appear anywhere in the stored cast list

### AC6: The API refuses stale and unknown deletes
Given cast member 12 is at revision 4
When a client deletes member 12 with revision 3, or deletes a member that doesn't exist
Then the response is 409 or 404 respectively, and nothing is removed

## Notes

- FRs: FR5, FR7
- Depends on: cast-management.E1.S1.
- Expected route: `DELETE /api/productions/{productionId}/cast/{castId}?revision=N`.
- Permanent by design (PRD FR5, ADR 0010). The file is rewritten without the member; no copy or history is kept. A deleted member's ID is never reused (see E2.S1).
- Deletion removes the member from the app's file, and saves sweep away any temp copies left by a crash. It isn't a secure disk wipe, and copies outside the app (such as backups of the data folder) are outside its control.
- Out of scope: undo, and an archive of past cast members.
