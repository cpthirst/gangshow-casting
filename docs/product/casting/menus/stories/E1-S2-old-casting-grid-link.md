---
id: casting-menus.E1.S2
title: Send old Casting grid links to Overview
epic: E1
status: done
---

## Story

As a member of the production team, I want my old "Casting grid" bookmark to still work, so that I land on the casting pages instead of "page not found".

## Acceptance criteria

### AC1: The old URL opens Overview
Given I open the app at "/casting-grid"
When the page loads
Then I see the "Overview" page heading
And the URL is "/casting/overview"

### AC2: Back doesn't return to the old URL
Given I went from the Cast page to "/casting-grid" and landed on Overview
When I press the browser's back button
Then I see the "Cast" page heading

## Notes

- FRs: FR4
- Depends on: casting-menus.E1.S1.
- The old URL replaces itself in the history, so back doesn't bounce the user to Overview again.
