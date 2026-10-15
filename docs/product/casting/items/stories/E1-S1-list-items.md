---
id: casting-items.E1.S1
title: List the show's items for casting
epic: E1
status: ready
---

## Story

As a member of the production team in a casting meeting, I want to see the show's items in running order on the Items page, so that we can work through casting item by item in show order.

## Acceptance criteria

### AC1: Items are listed in their halves, in running order
Given the latest saved running order has "Opening Number" and "Pirate Sketch" in the first half, and "Campfire Song" in the second half
When I open the Items page
Then I see "Opening Number" then "Pirate Sketch" under the first half's name
And "Campfire Song" under the second half's name

### AC2: Items show their running-order numbers
Given "Opening Number" and "Pirate Sketch" are items 1 and 2 on the Running order page
When I open the Items page
Then they show the numbers 1 and 2

### AC3: Items not in the printed programme are listed without a number
Given "Mystery Act" is not in the printed programme
When I open the Items page
Then "Mystery Act" is listed with no number and marked "Not in printed programme"

### AC4: There are no running-order controls
Given I open the Items page
When I look at any item
Then there are no drag handles and no move buttons

### AC5: The page shows which saved version it's based on
Given the latest saved running order is Draft 7
When I open the Items page
Then I see that the list is based on Draft 7

### AC6: A newly saved order shows when the page is opened again
Given I open the Items page, then save the running order as Draft 8 with "Campfire Song" moved to the first half
When I open the Items page again
Then "Campfire Song" is listed in the first half
And the list is based on Draft 8

### AC7: Unsaved running-order changes don't show
Given I have moved "Pirate Sketch" on the Running order page but not saved
When I open the Items page
Then "Pirate Sketch" is in its last saved place

## Notes

- FRs: FR1, FR4, FR5
- Depends on: casting-menus.E1.S1 (replaces the Items placeholder).
- No new API: it reads `GET /api/productions/{productionId}/running-order` (the latest saved version).
- Numbers come from the same function as the Running order page, never a copy of it.
- Items aren't links yet. Opening an item comes in casting-item-overview.E1.S1.
- Out of scope: role counts (E2.S1), no saved running order (E1.S2), the running clock.
