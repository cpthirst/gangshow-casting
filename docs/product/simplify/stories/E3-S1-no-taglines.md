---
id: simplify.E3.S1
title: Remove the page taglines that repeat Help
epic: E3
status: ready
---

## Story

As someone on the production team using a phone, I want pages to start with their content, not a line restating the title, so that I see the show's items sooner.

## Acceptance criteria

### AC1: Casting Items has no tagline
Given someone opens Casting Items
When the page loads
Then the line "The show's items, with how far each one's casting has got." no longer shows

### AC2: The Casting overview has no tagline
Given someone opens the Casting overview
When the page loads
Then the line "Everyone in the cast and how much they're cast." no longer shows

### AC3: The Production overview has no tagline
Given someone opens the Production overview
When the page loads
Then no description line shows between the title and the running order

### AC4: Help still says what each page is for
Given someone on any of those three pages
When they open its Help
Then the Help summary says what the page is for, as today

### AC5: A new page needs no description
Given the maintainer adds a page to the menu
When they declare its route
Then they aren't asked for a description that no page shows

## Notes

- FRs: FR9
- Depends on: none
- AC5 is met by removing the menu pages' unused description from the route declarations; the typecheck shows it.
