---
id: app-shell.E1.S1
title: Navigate between placeholder pages in a branded shell
epic: E1
status: done
---

## Story

As a production team volunteer, I want a branded app with a menu of its main areas, so that I can find the part of the casting tool I need at a glance.

## Acceptance criteria

### AC1: Shell shows the wordmark and menu
Given I open the app
When the page loads
Then the sidebar shows "Chester Gang Show" with "Casting" beneath it
And the menu lists "Running order", "Cast" and "Casting grid" in that order

### AC2: The root URL opens Running order
Given I open the app at "/"
When the page loads
Then I see the "Running order" page heading
And the browser tab title is "Running order · Chester Gang Show casting"

### AC3: Choosing a menu item shows its page
Given I am on the Running order page
When I choose "Cast" from the menu
Then I see the "Cast" page heading and its description
And the URL is "/cast"
And the browser tab title is "Cast · Chester Gang Show casting"

### AC4: A page loads directly from its URL
Given I open the app at "/casting-grid"
When the page loads
Then I see the "Casting grid" page heading

### AC5: The back button returns to the previous page
Given I went from the Running order page to the Cast page
When I press the browser's back button
Then I see the "Running order" page heading

### AC6: The current page is marked in the menu
Given I am on the Cast page
When I look at the menu
Then "Cast" is identified as the current page, visually and to assistive technology
And no other menu item is

### AC7: An unknown URL shows page not found
Given I open the app at "/no-such-page"
When the page loads
Then I see "Page not found"
And a link that takes me to the Running order page

### AC8: Keyboard users can skip to the content
Given I open the app using the keyboard
When I press Tab once
Then focus is on a "Skip to main content" link
And activating it moves focus to the page content

### AC9: The API status stays visible
Given the API is running with version "1.2.3"
When I open any page
Then I see "API: ok (1.2.3)" in the shell

### AC10: The app makes no third-party requests
Given the app's markup and styles
When they are loaded in a browser
Then no fonts, styles or scripts are fetched from another origin

## Notes

- FRs: FR1, FR2, FR3, FR4, FR5, FR7, FR8
- Depends on: none
- Styling (FR8, checked at review): Gang Show red `#ed3f23` for accents, large text and the current-page indicator, and `#e22e12` behind normal-size white text. Text is `#404040` on white, with `#f1f1f1` surfaces and Nunito Sans bundled with the app. Contrast is at least 4.5:1, and focus is visible.
- Page-level URLs add a client-side router: a new dependency, recorded in an ADR in this story.
- Adding a page later should need only a new page and a menu entry.
- Out of scope: the phone menu (E1.S2), sign-in, real data.
