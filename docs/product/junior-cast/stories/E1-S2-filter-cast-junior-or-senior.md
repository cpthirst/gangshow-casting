---
id: junior-cast.E1.S2
title: Filter the cast list to the Junior or Senior gang
epic: E1
status: done
---

## Story

As someone on the production team, I want to see only the Junior or only the Senior cast on the Cast page, so that I can check each gang's list on its own.

## Acceptance criteria

### AC1: The Junior gang is Beavers and Cubs
Given "Poppy Example" (Beavers), "Ollie Sample" (Cubs), "Sam Specimen" (Scouts) and "Jo Newcomer" (no section)
When someone filters the Cast page by gang Junior
Then Poppy Example and Ollie Sample are listed, and no one else

### AC2: The Senior gang is everyone else, including no section
Given the same cast
When someone filters the Cast page by gang Senior
Then Sam Specimen and Jo Newcomer are listed, and no one else

### AC3: The gang filter starts at All
Given the same cast
When someone opens the Cast page
Then the gang filter is set to All and all four are listed

### AC4: The gang filter combines with the other filters
Given the same cast
When someone filters by gang Junior and last name "Sample"
Then only Ollie Sample is listed

### AC5: Help describes the two gangs
Given the Help page
When someone reads the Cast page's entry
Then it describes the Junior gang (Beavers, Cubs) and the Senior gang (Scouts, Explorers, Network, and anyone with no section)

## Notes

- FRs: FR1 (which sections are Junior), FR7 (gang filter), FR9, FR11
- Depends on: E1.S1
- Which gang a member is in is one rule in one place, kept with the list of sections. The Cast page filter here and the casting search in E2.S2 both read it (FR9).
- "Gang" is the word the item's control uses too (E2.S1), because the item already has a free-text Cast field.
- The "N of M cast members" count and the empty state already come from the shared cast filters. Check they're wired up; don't test them again.
- AC5 checks Help's structure (the entry mentions both gangs), not its exact wording.
- Out of scope: a gang column in the cast list.
