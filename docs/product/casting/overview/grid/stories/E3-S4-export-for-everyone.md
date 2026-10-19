---
id: casting-overview-grid.E3.S4
title: Export to Excel for every team member, beside the view switch
epic: E3
status: done
---

## Story

As any member of the production team, I want an "Export to Excel" button beside the By person and Grid switch, so that I can take the grid to a meeting without asking an admin.

## Acceptance criteria

### AC1: The button sits beside the view switch, with an icon and words
Given I am on the Overview showing the grid
When I look at the By person / Grid switch
Then beside it is a button styled like the switch's buttons, showing the Excel file icon and the words "Export to Excel"
And there is no export icon beside the page title

### AC2: It's named by its words alone
Given the export button is showing
When I hover over it, or a screen reader reads it
Then it is named "Export to Excel", with no hover note

### AC3: The button only shows on the grid
Given I am on the Overview showing people by section
Then there is no export button

### AC4: A Casting Team Member can export
Given I am signed in as a Casting Team Member
When I export the grid
Then the button is shown, and the API makes the file rather than refusing it

### AC5: A Read-Only Team Member can export
Given I am signed in as a Read-Only Team Member
When I export the grid
Then the button is shown, and the API makes the file rather than refusing it as read-only

### AC6: Read-only members still can't change anything else
Given I am signed in as a Read-Only Team Member
When I try any other change that isn't a read
Then the API still refuses it with "You have read-only access."

### AC7: The post-deploy check expects the export to work for every role
Given the post-deploy check runs
When it tries the export as the member and the read-only account
Then it doesn't expect the export to be refused

## Notes

- FRs: FR12 (amended: every signed-in team member, not only admins).
- Decision: [ADR 0021](../../../../adr/0021-excel-export-for-every-team-role.md) amends ADR 0019 (who may export) and ADR 0020 (read-only refusals).
- This replaces E3.S2's AC1 (the icon beside the title), AC2 (no button for non-admins) and its "team only" tooltip, and team-roles.E2.S3's "no Export to Excel button" for read-only members.
- The "for the production team only" note is removed, at the maintainer's choice (2026-10-19), as the button now says what it does in words.
- Out of scope: what the file holds, how it's named, and its colours, which all stay as in E3.S2 and E3.S3.
