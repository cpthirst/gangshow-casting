---
id: app-shell.E1.S2
title: Use the menu on a phone
epic: E1
status: in-progress
---

## Story

As a production team volunteer at a rehearsal, I want the menu tucked behind a button on my phone, so that the page has room and I can still move between areas.

## Acceptance criteria

### AC1: The menu starts closed on a phone
Given I open the app on a phone-width screen
When the page loads
Then I see a "Menu" button that reports the menu as closed
And the menu links are hidden

### AC2: The menu button opens the menu
Given the menu is closed on a phone-width screen
When I press the "Menu" button
Then the menu appears over the page
And the button reports the menu as open

### AC3: Choosing a page closes the menu
Given the menu is open on a phone-width screen
When I choose "Cast"
Then I see the "Cast" page
And the menu is closed

### AC4: Escape closes the menu and returns focus
Given the menu is open on a phone-width screen
When I press Escape
Then the menu is closed
And focus is back on the "Menu" button

### AC5: Wide screens keep the sidebar
Given I open the app on a laptop-width screen
When the page loads
Then the menu is always visible in the sidebar
And no "Menu" button is shown

## Notes

- FRs: FR6
- Depends on: app-shell.E1.S1
- Phone width means below 768px. The layout must not scroll horizontally at 360px.
- Out of scope: swipe gestures, and remembering whether the menu was open.
