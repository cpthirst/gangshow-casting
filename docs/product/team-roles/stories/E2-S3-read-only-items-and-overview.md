---
id: team-roles.E2.S3
title: Show the Items pages and Overview read-only
epic: E2
status: ready
---

## Story

As a Read-Only Team Member reviewing casting, I want to see each item's roles, who is cast in them and the item's notes, and the Overview, without editing controls, so that I can review the casting item by item and across the show.

## Acceptance criteria

### AC1: The Items list opens each item
Given "jo" is a Read-Only Team Member
When jo opens the Items list
Then every item is listed as for everyone
And each item's control is labelled "View Pirate Panic" (not "Cast Pirate Panic") and opens that item's page

### AC2: An item's roles and notes are shown in full
Given "jo" is a Read-Only Team Member and "Pirate Panic" has the role "Captain Hook" with "Ava Example" cast, and the notes "Hat change"
When jo opens Pirate Panic's page
Then jo sees the role, its size, who is cast in it, and the notes "Hat change"
And Previous and Next move between items as for everyone

### AC3: No role or notes editing
Given "jo" is a Read-Only Team Member
When jo opens Pirate Panic's page
Then there is no "Add role" button, no Edit or Remove control on any role, and no notes box or Save button for the notes

### AC4: An item with no roles or notes still reads well
Given "jo" is a Read-Only Team Member and "Dance One" has no roles and no notes
When jo opens Dance One's page
Then jo sees that it has no roles and no notes yet, with no prompt to add any

### AC5: The Overview is shown in full
Given "jo" is a Read-Only Team Member
When jo opens the Overview
Then jo sees the role totals, every person's timeline with clashes, and the casting grid, and can switch between the views
And there is no Export to Excel button

### AC6: The pages say why
Given "jo" is a Read-Only Team Member
When jo opens the Items list, an item's page, or the Overview
Then jo sees "You have read-only access" as text on the page

### AC7: Other roles are unchanged
Given "sam" is a Casting Team Member and "alex" is an Admin
When each opens the Items list, Pirate Panic's page and the Overview
Then they see the controls they see today, and no "You have read-only access" line

## Notes

- FRs: FR5, FR6
- Depends on: team-roles.E1.S1
- With this story, every page the app has for a Casting Team Member reads fully for a Read-Only Team Member (FR5). Accounts stays admin-only.
- Out of scope: the Running order (E2.S1) and the Cast page (E2.S2).
