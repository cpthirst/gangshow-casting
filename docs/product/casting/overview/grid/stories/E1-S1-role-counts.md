---
id: casting-overview-grid.E1.S1
title: Show how many roles the show has
epic: E1
status: ready
---

## Story

As a member of the production team, I want the Overview to start with how many lead, support and cameo roles the show has, so that I can see how big the show is without counting.

## Acceptance criteria

The examples use a show with 2 lead roles, 3 support roles and 1 cameo role, plus an ensemble role "Pirates".

### AC1: Totals sit at the top of Overview
Given the show has 2 lead, 3 support and 1 cameo roles
When I open the Overview
Then I see "Lead 2", "Support 3" and "Cameo 1" above the cast, as large text

### AC2: Roles nobody is cast in still count
Given a lead role "Captain Hook" that has no cast member
When I open the Overview
Then "Captain Hook" is included in the Lead total

### AC3: Ensemble roles are left out
Given the ensemble role "Pirates" with 4 cast members
When I open the Overview
Then no ensemble figure is shown
And the Lead, Support and Cameo totals do not change because of "Pirates"

### AC4: Totals follow role changes
Given the Overview shows "Support 3"
When a team member adds a support role and I reload the Overview
Then it shows "Support 4"

### AC5: Removing a role lowers the total
Given the Overview shows "Cameo 1"
When a team member removes the cameo role and I reload the Overview
Then it shows "Cameo 0"

### AC6: A show with no roles shows zeros
Given the show has no roles
When I open the Overview
Then I see "Lead 0", "Support 0" and "Cameo 0"

### AC7: Totals only count this production
Given another production has 5 lead roles
When I open the Overview of this production
Then the Lead total counts only this production's roles

## Notes

- FRs: FR1, FR2, FR3
- Depends on: none
- The totals are visible without scrolling or tapping at 320px width (PRD goal). The Overview's browser layout walk already covers sideways scrolling.
- Out of scope: how many of each size are uncast (PRD decision), and the grid (E2).
