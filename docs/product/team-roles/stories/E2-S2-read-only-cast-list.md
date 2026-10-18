---
id: team-roles.E2.S2
title: Show the Cast list read-only
epic: E2
status: done
---

## Story

As a Read-Only Team Member reviewing casting, I want to see the cast and their casting notes without editing controls, so that I can judge who suits which part without changing anyone's details.

## Acceptance criteria

### AC1: The cast list is shown in full, notes included
Given "jo" is a Read-Only Team Member and "Ava Example" has the Singing note "Strong alto"
When jo opens the Cast page
Then jo sees every cast member's name, section, group, Singing and Acting notes
And sees "Strong alto" beside Ava Example

### AC2: Filters still work
Given "jo" is a Read-Only Team Member
When jo filters the cast by section "Explorers"
Then only Explorers are listed, with the count of matches, as for everyone

### AC3: No editing controls
Given "jo" is a Read-Only Team Member
When jo opens the Cast page
Then there is no "Add cast member" button
And no Edit or Delete control on any cast member

### AC4: The page says why
Given "jo" is a Read-Only Team Member
When jo opens the Cast page
Then jo sees "You have read-only access" as text on the page

### AC5: Other roles are unchanged
Given "sam" is a Casting Team Member and "alex" is an Admin
When each opens the Cast page
Then they see the controls they see today (Delete disabled for sam, with its reason), and no "You have read-only access" line

## Notes

- FRs: FR5, FR6
- Depends on: team-roles.E1.S1
- The Actions column is left out for read-only members, as it holds only controls.
- Out of scope: the Running order (E2.S1), and the Items and Overview pages (E2.S3).
