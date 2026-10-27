---
id: production-props.E1.S2
title: Show change controls only to those permitted
epic: E1
status: done
---

## Story

As a stage manager with only Stage permission, I want the casting pages to show me the casting without controls I can't use, so that I never try a change the app will refuse.

## Acceptance criteria

### AC1: Without Casting, the casting pages are read-only
Given "pat" has the Stage permission only
When pat opens the Running order, Cast, Casting Items, an item's casting page or the Casting Overview
Then each shows the view a Read-Only Team Member sees today: no add, edit, remove, move, drag, notes editing, Save or Reset
And each shows the line "You can view the casting, but not change it."

### AC2: Casting permission keeps today's controls
Given "sam" has the Casting permission
When sam opens the same pages
Then sam sees the controls a Casting Team Member sees today, and no read-only line

### AC3: Casting plus another permission still edits casting
Given "kim" has the Casting and Stage permissions
When kim opens the Cast page
Then kim can add and edit cast members

### AC4: No permissions is read-only everywhere
Given "jo" has no permissions
When jo opens any page
Then jo sees the read-only view and the read-only line, as today

### AC5: Exports stay open to everyone
Given "pat" has the Stage permission only
When pat opens the Casting Overview
Then the Excel and Word exports are offered, as for every role today

### AC6: A refused change shows the read-only view
Given "pat" had Casting when the page loaded, and has since lost it
When pat saves a casting change and the API refuses it as read-only
Then the page says so and shows the read-only view, as it does today for a read-only member

## Notes

- FRs: FR3
- Depends on: production-props.E1.S1
- On a page, "read-only" now means "can't change this page's department". The casting pages and Running order ask whether the account can change Casting, not whether it is read-only. The Stage pages ask the same about Stage when they're built (E4).
- Admin-only controls (such as Save version, deleting a cast member, Accounts) still need an Admin, as today.
- Out of scope: the Accounts page (E2) and the menu (E3).
