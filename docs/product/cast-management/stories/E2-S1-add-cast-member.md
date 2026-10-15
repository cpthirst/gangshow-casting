---
id: cast-management.E2.S1
title: Add a cast member
epic: E2
status: done
---

## Story

As a member of the production team, I want to add a new cast member, so that people who join the show are on the list straight away.

## Acceptance criteria

### AC1: Adding a cast member
Given the cast list is open
When I choose "Add cast member", enter first name "Jo", last name "Newcomer", section "Scouts" and group "1st Somewhere", and save
Then "Jo Newcomer" appears in the list in surname order
And the count goes up by one

### AC2: Section and group are optional
Given I'm adding a cast member
When I enter only first name "Jo" and last name "Newcomer" and save
Then "Jo Newcomer" is added with section "Not set" and a blank group

### AC3: Names are required
Given I'm adding a cast member
When I leave the first name or last name empty and save
Then I see "Enter a first name" or "Enter a last name" next to the field
And nobody is added

### AC4: Long values are refused
Given I'm adding a cast member
When I enter a first name of 41 characters or a group of 61 characters and save
Then I see what the limit is next to the field
And nobody is added

### AC5: Cancelling adds nobody
Given I've started adding a cast member and typed a name
When I cancel
Then nobody is added and the list is unchanged

### AC6: The new member gets an ID that's never reused
Given the highest ID on the cast list is 56
When a cast member is added
Then they get ID 57
And the ID of a deleted member is never given to someone new

### AC7: The API adds a cast member
Given the 2027 cast list is stored
When a client posts a valid new cast member to /api/productions/2027/cast
Then the response is 201 with the saved member, including its new ID and revision 1

### AC8: The API refuses invalid details
Given the 2027 cast list is stored
When a client posts a member with an empty first name, a section outside the allowed list, or an extra field such as a date of birth
Then the response is 400 and nothing is saved

## Notes

- FRs: FR3, FR6, FR7
- Depends on: cast-management.E1.S1.
- The form is a reusable component for E2.S2. Validation uses the shared schema, with a friendly message next to each field (as in the running order's item editor).
- The schema rejects unknown fields rather than stripping them, so no extra personal data can be stored by accident (ADR 0010).
- To stop deleted IDs being reused, the store keeps the next ID to assign, not just the highest current one.
- Out of scope: a duplicate-name warning (an open question in the PRD), mass upload, and starting a cast list for a production that has none (the API adds only to an existing list; 2027 has one). Follow-up if new productions need it.
