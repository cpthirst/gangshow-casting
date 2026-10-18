---
id: team-roles.E2.S1
title: Show the Running order read-only
epic: E2
status: ready
---

## Story

As a Read-Only Team Member reviewing the show, I want to see the running order without any editing controls, so that I can read it clearly on my phone without worrying about changing it.

## Acceptance criteria

### AC1: The running order is shown in full
Given "jo" is a Read-Only Team Member and the running order is at Draft 6
When jo opens the Running order
Then jo sees both halves, every item's details, numbers, start times, the interval, each half's total and the projected finish, as a Casting Team Member does
And sees "Draft 6"

### AC2: No editing controls
Given "jo" is a Read-Only Team Member
When jo opens the Running order
Then there are no drag handles, and no Move up, Move down, Move to other half, Edit, Remove or Add item controls
And no Save or Reset

### AC3: Rows can't be dragged
Given "jo" is a Read-Only Team Member
When jo tries to drag "Pirate Panic" to another place
Then nothing moves and there are no unsaved changes

### AC4: The page says why
Given "jo" is a Read-Only Team Member
When jo opens the Running order
Then jo sees "You have read-only access" as text on the page, without hovering

### AC5: Other roles are unchanged
Given "sam" is a Casting Team Member and "alex" is an Admin
When each opens the Running order
Then they see the controls they see today, and no "You have read-only access" line

### AC6: An empty half still reads well
Given "jo" is a Read-Only Team Member and the second half has no items
When jo opens the Running order
Then the second half shows "No items", with no hint to drag or add one

## Notes

- FRs: FR5, FR6
- Depends on: team-roles.E1.S1, which gives the pages the person's role
- The "read-only access" line is the same wording and look on every page (E2.S2, E2.S3).
- Columns that hold only controls (Move) are left out for read-only members, so the table reads cleanly in card mode on phones.
- Out of scope: the Cast, Items and Overview pages (E2.S2, E2.S3).
