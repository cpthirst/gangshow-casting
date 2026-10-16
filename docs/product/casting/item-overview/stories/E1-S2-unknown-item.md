---
id: casting-item-overview.E1.S2
title: Show not found for an item that isn't in the running order
epic: E1
status: done
---

## Story

As a member of the production team, I want a clear message when an item link is out of date, so that I can get back to the current list instead of seeing a broken page.

## Acceptance criteria

### AC1: An unknown item shows not found
Given the latest saved running order has no item with the ID "no-such-item"
When I open the app at "/casting/items/no-such-item"
Then I see "Item not found"
And a link back to the Items list

### AC2: The link returns to the Items list
Given I see "Item not found"
When I choose the link back to the Items list
Then I see the Items page

### AC3: A failed load isn't shown as not found
Given the running order can't be loaded because the API is unavailable
When I open the "Pirate Sketch" page
Then I see that the item couldn't be loaded
And I don't see "Item not found"

## Notes

- FRs: FR6
- Depends on: casting-item-overview.E1.S1.
- "Not in the running order" means not in the latest saved version, even if an older version had it.
