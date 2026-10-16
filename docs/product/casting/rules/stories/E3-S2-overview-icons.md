---
id: casting-rules.E3.S2
title: Show clash icons on the Overview
epic: E3
status: in-progress
---

## Story

As a section leader, I want the Overview to show which of my young people have a casting clash anywhere in the show, so that I can raise it without checking every item.

## Acceptance criteria

### AC1: A person with a clash shows an icon at their worst severity
Given "Sam Example" has a back-to-back error and a quick-change info
When I open the Overview
Then Sam's card shows an Error icon

### AC2: The description lists each clash and its items
Given Sam has the clashes in AC1
When I hover over or focus the icon
Then I see each clash with its items, worst first, for example "Error: back-to-back. Lead in 'Opening Number', then Support in 'Pirate Sketch'" and "Info: quick change. 6 minutes between 'Song Two' and 'Campfire Song'"

### AC3: People without clashes have no icon
Given "Alex Sample" has no clashes
When I open the Overview
Then Alex's card has no icon

### AC4: A person with only quick changes shows Info
Given "Jo Newcomer"'s only clash is a quick-change info
When I open the Overview
Then Jo's card shows an Info icon

### AC5: On phones the description is written out
Given Sam's card shows an Error icon
When I open the Overview on a phone
Then the description is written out on Sam's card, with no hover or tap needed
And the page doesn't scroll sideways

### AC6: A failed casting load shows no icons
Given the cast loads but the roles or the running order can't be loaded
When I open the Overview
Then I see that the casting couldn't be loaded
And no clash icons are shown

## Notes

- AC2's example wording updated on 2026-10-16 to the description wording the user agreed during casting-rules.E2.S3.
- FRs: FR9, FR10, FR13
- Depends on: casting-rules.E2.S3.
- Uses the same icons and the same clash calculation as the item page.
- The icon sits alongside the existing pills; the order of people (casting score) is unchanged.
- Showing info on this page follows the PRD's assumption (Open questions).
