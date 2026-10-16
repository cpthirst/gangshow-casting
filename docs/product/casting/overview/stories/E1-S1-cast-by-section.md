---
id: casting-overview.E1.S1
title: List the whole cast by section
epic: E1
status: done
---

## Story

As a member of the production team, I want to see the whole cast on the Overview, grouped by section, so that I can look across everyone at once instead of opening each item.

## Acceptance criteria

### AC1: Everyone is listed under their section
Given the cast has "Sam Example" (Scouts), "Alex Sample" (Explorers) and "Kit Person" (Network)
When I open the Overview
Then I see a "Scouts" section with "Sam Example", an "Explorers" section with "Alex Sample" and a "Network" section with "Kit Person"

### AC2: Sections come in a fixed order, with people who have no section last
Given the cast has people in every section and "Jo Newcomer" with no section
When I open the Overview
Then the sections read "Scouts", "Explorers", "Network", "Not set"
And "Jo Newcomer" is under "Not set"

### AC3: Empty sections aren't shown
Given nobody in the cast is in Network
When I open the Overview
Then there is no "Network" section

### AC4: Each section says how many people are in it
Given the Scouts section has 3 people
When I open the Overview
Then the Scouts heading shows "3 people"

### AC5: Each person is a card like a role card
Given "Sam Example" is a Scout
When I open the Overview
Then "Sam Example" is shown as a card with their name in bold, in the same style as a role card on an item's page

### AC6: Each section is a list
Given the Scouts section has 3 people
When a screen reader reaches the section
Then it is announced as a list of 3 items

### AC7: A failed load is reported, not shown as an empty cast
Given the cast can't be loaded because the API is unavailable
When I open the Overview
Then I see that the cast couldn't be loaded
And no section is shown

### AC8: The Overview replaces the placeholder
Given I am on any page
When I choose "Overview" under "Casting" in the menu
Then I see the Overview's sections, not "Coming soon"
And the URL is still "/casting/overview"

## Notes

- FRs: FR1, FR8 (cast), FR9
- Depends on: none (the menu entry exists from casting-menus).
- No new API: reads `GET /api/productions/{productionId}/cast`.
- Within a section, people are ordered by last name, then first name, for now (sortCast). E2.S2 replaces this with the casting score.
- An empty cast (no cast list, or nobody in it) says "No cast members yet." rather than showing empty sections.
- UI consistency (PRD NFR): reuse the role card styles and the item page's headings; check at 320 and 360px for no sideways scrolling.
- Out of scope: pills and counts (E2.S1), ordering by score (E2.S2).
