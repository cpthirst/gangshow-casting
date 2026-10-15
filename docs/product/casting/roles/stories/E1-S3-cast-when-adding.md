---
id: casting-roles.E1.S3
title: Cast someone when adding a role
epic: E1
status: ready
---

## Story

As a member of the production team in a casting meeting, I want to pick who plays a part as I add it, by typing part of their name, so that the decision is recorded straight away without scrolling through the whole cast.

## Acceptance criteria

### AC1: Picking a cast member when adding a role
Given "Sam Example" is on the cast list
When I add a lead role "Captain Hook" to "Pirate Sketch", type "sam" in "Cast member", choose "Sam Example" and save
Then the "Captain Hook" card shows "Sam Example"

### AC2: Typing narrows the choices by first or last name
Given the cast has "Sam Example", "Alex Sample" and "Jo Newcomer"
When I type "samp" in "Cast member"
Then only "Alex Sample" is offered

### AC3: Matching ignores case and accents
Given the cast has "Zoë Adams"
When I type "zoe" in "Cast member"
Then "Zoë Adams" is offered

### AC4: Choices show section and group
Given "Sam Example" is a Scout in "1st Somewhere"
When "Sam Example" is offered
Then the choice shows "Scouts" and "1st Somewhere" alongside the name

### AC5: Choosing works by keyboard
Given I've typed "sam" and "Sam Example" is offered
When I press the down arrow and then Enter
Then "Sam Example" is chosen

### AC6: No matches is explained
Given no cast member's name contains "xyz"
When I type "xyz" in "Cast member"
Then I see "No cast members match"

### AC7: Leaving it blank adds the role uncast
Given I'm adding a role
When I leave "Cast member" empty and save
Then the role is added and its card shows "Uncast"

### AC8: Typed text that isn't chosen is refused
Given I'm adding a role
When I type "sam" in "Cast member" without choosing anyone, and save
Then I see "Choose a cast member from the list, or clear the field" next to the field
And no role is added

### AC9: One person can be in several roles in an item
Given "Sam Example" plays "Captain Hook" in "Pirate Sketch"
When I add a cameo role "Parrot" to "Pirate Sketch" with "Sam Example"
Then both cards show "Sam Example"

### AC10: The API refuses unknown and extra cast members
Given cast member 12 exists and cast member 99 doesn't
When a client posts a lead role with cast members [99], or with cast members [12, 13]
Then the response is 400 and nothing is stored

### AC11: The API accepts an ensemble with several members
Given cast members 12 and 13 exist
When a client posts an ensemble role with cast members [12, 13]
Then the response is 201 with both members in the role

## Notes

- FRs: FR1 (cast member), FR2, FR10
- Depends on: casting-roles.E1.S1, casting-item-overview.E2.S1 (cards).
- The field follows the WAI-ARIA combobox pattern, and the number of matches is announced (NFR).
- Matching is the same as the Cast page's name filter (cast-management FR2). Reuse it, don't copy it.
- Roles store cast member IDs, never names (ADR 0010). The page looks names up in the cast list.
- An ensemble role also takes one person here. More members come in E2.S2.
- Showing section and group is the PRD's assumption, to tell apart people with the same name.
