---
id: casting-item-overview.E1.S1
title: Open an item's casting page
epic: E1
status: done
---

## Story

As an item leader, I want to open my item from the Items list and see its name and place in the show, so that I know I'm casting the right item.

## Acceptance criteria

### AC1: Choosing an item opens its page
Given "Pirate Sketch" is item 2 in the first half
When I choose "Pirate Sketch" on the Items page
Then I see the "Pirate Sketch" page heading
And I see "Item 2 · First half"

### AC2: An item not in the printed programme shows its half only
Given "Mystery Act" is in the second half and not in the printed programme
When I open the "Mystery Act" page
Then I see "Second half · Not in printed programme"

### AC3: An item with no roles shows an empty state
Given "Pirate Sketch" has no roles
When I open its page
Then I see "No roles have been added yet."

### AC4: The page has its own URL and tab title
Given "Pirate Sketch" has the running-order ID "pirate-sketch"
When I open its page
Then the URL is "/casting/items/pirate-sketch"
And the browser tab title is "Pirate Sketch · Chester Gang Show casting"

### AC5: The page loads directly from its URL
Given I open the app at "/casting/items/pirate-sketch"
When the page loads, or I refresh it
Then I see the "Pirate Sketch" page heading

### AC6: Items is marked as current while on an item
Given I am on the "Pirate Sketch" page
When I look at the menu
Then "Items" is identified as the current page, visually and to assistive technology

### AC7: There's a way back to the Items list
Given I am on the "Pirate Sketch" page
When I choose "All items" in the breadcrumb above the item's title
Then I see the Items page

### AC8: Each item on the list has a Cast button named after it
Given "Pirate Sketch" is on the Items page
When I look at its row, or a screen reader reaches it
Then it has a Cast button that opens its page, in a table laid out like the Running order with the button where the move and edit buttons are
And the button is announced as "Cast Pirate Sketch"

## Notes

- FRs: FR1, FR2, FR5, FR7; also casting-items FR3 (AC1, AC8) and the item-page part of casting-menus FR5 (AC6).
- Depends on: casting-items.E1.S1.
- No new API: name and position come from the latest saved running order.
- AC7 and AC8 changed on 2026-10-15 at the production team's request: "All items" is breadcrumb navigation above the title, and each item on the list has a Cast icon button (two people) like the Running order's edit button, instead of the whole row being a link.
- Out of scope: items that aren't in the running order (E1.S2), roles (casting-roles), next/previous item.
