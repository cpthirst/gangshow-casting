---
id: cast-management.E1.S2
title: Filter the cast list by name and section
epic: E1
status: done
---

## Story

As a member of the production team, I want to narrow the cast list by name or section, so that I can find a cast member quickly during or after a rehearsal.

## Acceptance criteria

### AC1: Filtering by first name
Given the cast includes "Sam Example", "Samira Sample" and "Alex Other"
When I type "sam" in the first name filter
Then I see "Sam Example" and "Samira Sample" only

### AC2: Filtering by last name
Given the cast includes "Sam Example" and "Alex Sample"
When I type "SAMP" in the last name filter
Then I see "Alex Sample" only

### AC3: Names match regardless of accents
Given the cast includes "Zoë Example"
When I type "zoe" in the first name filter
Then I see "Zoë Example"

### AC4: Filtering by section
Given the cast has Scouts, Explorers and a member with no section
When I choose "Explorers" in the section filter
Then I see only the Explorers
And choosing "Not set" shows only the member with no section

### AC5: Filters combine
Given the cast includes "Sam Example" (Scouts) and "Sam Sample" (Explorers)
When I type "sam" in the first name filter and choose "Scouts"
Then I see "Sam Example" only

### AC6: The count shows matches out of the total
Given the cast has 56 members and my filters match 12
When I look at the count
Then it reads "12 of 56 cast members"
And screen readers are told the new count when the filters change

### AC7: Nothing matches
Given my filters match no one
When I look at the list
Then I see "No cast members match these filters"

### AC8: Clearing the filters
Given I've filtered by first name and section
When I choose "Clear filters"
Then all filters are empty and the whole list is shown

## Notes

- FRs: FR2
- Depends on: cast-management.E1.S1.
- Filtering happens in the browser on the loaded list. The section filter offers All, Scouts, Explorers, Network and Not set.
- Out of scope: filtering by group, and remembering filters between visits.
