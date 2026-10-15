---
id: casting-menus.E1.S1
title: Show a Casting group with Overview and Items
epic: E1
status: ready
---

## Story

As a member of the production team, I want a Casting menu with Overview and Items inside it, so that I can get to the show-wide view or item-by-item casting in one step.

## Acceptance criteria

### AC1: The menu shows Casting with its two sub-pages
Given I open the app
When I look at the menu
Then it lists "Running order", "Cast" and "Casting", in that order
And "Overview" and "Items" are listed under "Casting", in that order
And "Casting grid" is no longer in the menu

### AC2: The sub-pages are a nested list
Given I use a screen reader
When I reach "Casting" in the menu
Then "Overview" and "Items" are announced as a list inside it

### AC3: Overview is a placeholder page
Given I am on any page
When I choose "Overview" from the menu
Then I see the "Overview" page heading and "Who is in which item, across the whole show."
And the URL is "/casting/overview"
And the browser tab title is "Overview · Chester Gang Show casting"

### AC4: Items is a placeholder page
Given I am on any page
When I choose "Items" from the menu
Then I see the "Items" page heading and a one-line description
And the URL is "/casting/items"

### AC5: Sub-pages load from their URL
Given I open the app at "/casting/items"
When the page loads, or I refresh it
Then I see the "Items" page heading

### AC6: Back and forward work between sub-pages
Given I went from Overview to Items
When I press the browser's back button
Then I see the "Overview" page heading

### AC7: The current sub-page is marked in the menu
Given I am on the Items page
When I look at the menu
Then "Items" is identified as the current page, visually and to assistive technology
And no other menu item is

### AC8: The casting path on its own opens Overview
Given I open the app at "/casting"
When the page loads
Then I see the "Overview" page heading

### AC9: Sub-pages are in the mobile menu
Given my screen is phone width and I have opened the menu
When I choose "Items" under "Casting"
Then I see the "Items" page heading
And the menu closes

## Notes

- FRs: FR1, FR2, FR3, FR5, FR6
- Depends on: none.
- "Casting" is a group label, not a link, and its sub-pages are always shown (PRD assumption).
- Adding a page stays one page plus one menu entry (app-shell): the group should be a single entry in `menuPages` with its children.
- Items is a placeholder until casting-items.E1.S1. The item-page part of FR5 is in casting-item-overview.E1.S1.
- Out of scope: the old `/casting-grid` URL (E1.S2).
