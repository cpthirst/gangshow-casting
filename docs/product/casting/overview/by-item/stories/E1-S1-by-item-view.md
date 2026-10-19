---
id: casting-overview-by-item.E1.S1
title: See every item's roles and cast in show order
epic: E1
status: ready
---

## Story

As a member of the production team, I want a "By item" view on the Overview that lists every item in show order with its roles and who plays them, so that I can check or brief the whole show's casting without opening each item's page.

## Acceptance criteria

### AC1: The view switch has a By item choice
Given I am on the Overview
When I look at the view switch
Then it offers "By person", "Grid" and "By item", in that order
And choosing "By item" shows the By item view and marks it as the chosen view

### AC2: Items are listed in show order under their half
Given a running order whose first half is "Act One" with "Opening" and "Campfire Song", and whose second half is "Act Two" with "Finale"
When I choose "By item"
Then I see "Act One" followed by "Opening" then "Campfire Song", then "Act Two" followed by "Finale"

### AC3: Each item shows its title and programme number
Given "Campfire Song" is item 2 in the printed programme
When I choose "By item"
Then its heading reads "2 Campfire Song", numbered as on the Running order page

### AC4: Each item has a table of its roles
Given "Opening" has a lead role "Fairy Godmother" played by Ava Example
When I choose "By item"
Then under "Opening" is a table with the headings "Role name", "Role type" and "Cast"
And a row reads "Fairy Godmother", "Lead", "Ava Example"

### AC5: An ensemble role lists everyone in it
Given "Opening" has an ensemble role "Villagers" played by Ben Sample and Cara Test
When I choose "By item"
Then the "Villagers" row's Cast shows both "Ben Sample" and "Cara Test", in the order the item's page lists them

### AC6: Roles are ordered by size, then name
Given "Opening" has the roles "Villagers" (ensemble), "zebra" (cameo), "Apple" (cameo) and "Fairy Godmother" (lead)
When I choose "By item"
Then its rows are in the order "Fairy Godmother", "Apple", "zebra", "Villagers"

### AC7: Every team role sees the same view, with nothing to edit
Given I am signed in as an Admin, a Casting Team Member or a Read-Only Team Member
When I choose "By item"
Then I see the same items, roles and cast
And the view offers no way to add, edit or remove roles or casting

### AC8: The page still loads when there is nothing to show
Given the production has no items in its latest saved running order
When I choose "By item"
Then the view says there are no items yet, rather than showing an empty space

## Notes

- FRs: FR1, FR2, FR4, FR6
- Depends on: none
- "Role type" is the role size, shown as on the item page (Lead, Support, Cameo, Ensemble), in text, not colour alone.
- Uses real headings per half and item, and table header cells, so screen readers can move by item (PRD accessibility NFR).
- Browser layout test: a walk of this view at 320px and 360px is not added unless the user agrees (CLAUDE.md, ADR 0011). Offer it when implementing.
- Out of scope: unprinted items, "Uncast" and items with no roles (E1.S2); exports (E2).
