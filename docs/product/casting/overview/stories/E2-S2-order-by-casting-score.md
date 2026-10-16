---
id: casting-overview.E2.S2
title: Order each section by casting score
epic: E2
status: ready
---

## Story

As a member of the production team, I want each section ordered by how much and how big people's parts are, so that the most heavily cast are at the top and anyone with little or nothing stands out at the bottom.

## Acceptance criteria

### AC1: Highest casting score first
Given in Scouts "Kit Person" has 4 ensemble roles (score 4), "Sam Example" has 1 lead (score 8) and "Zoe Adams" has 3 supports (score 9)
When I open the Overview
Then the Scouts section reads "Zoe Adams", "Sam Example", "Kit Person"

### AC2: One lead outranks two supports or three cameos
Given in Scouts "Sam Example" has 1 lead (8), "Alex Sample" has 2 supports (6) and "Ben Carter" has 3 cameos (6)
When I open the Overview
Then "Sam Example" is listed above both "Alex Sample" and "Ben Carter"

### AC3: Equal scores are ordered by total roles
Given "Alex Sample" has 2 supports (6, 2 roles) and "Ben Carter" has 3 cameos (6, 3 roles)
When I open the Overview
Then "Ben Carter" is listed above "Alex Sample"

### AC4: Then by last name and first name
Given "Amy Carter" and "Zoe Adams" each have 1 lead and nothing else
When I open the Overview
Then "Zoe Adams" is listed above "Amy Carter"

### AC5: People with no parts are at the bottom
Given in Scouts "Jo Newcomer" has no roles and everyone else has at least one ensemble role
When I open the Overview
Then "Jo Newcomer" is the last card in Scouts, marked "No parts yet"

### AC6: Each section is ordered on its own
Given an Explorer has a higher score than every Scout
When I open the Overview
Then the sections stay in their order (Scouts, Explorers, Network, Not set)
And the Explorer is ordered only among the Explorers

### AC7: The score isn't shown
Given "Sam Example" has a casting score of 8
When I open the Overview
Then Sam's card shows their pills but no score

## Notes

- FRs: FR3, FR4, FR5 (ordering)
- Depends on: casting-overview.E2.S1.
- Scores per role: lead 8, support 3, cameo 2, ensemble 1 (PRD FR3, agreed weights). Ordering is a plain function, unit-tested.
- Someone with no roles scores 0 and has 0 roles, so FR4 already puts them last; AC5 pins it down.
- Out of scope: showing the score (PRD Open questions), weighting ensembles by size.
