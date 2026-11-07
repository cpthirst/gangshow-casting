---
id: simplify.E4.S2
title: Load the list pages' data the shared way
epic: E4
status: draft
---

## Story

As the maintainer, I want every list page to load its data the same shared way as the item pages, so that no page has its own copy of the loading and failure rules.

## Acceptance criteria

### AC1: Each list page loads as today
Given a production with a cast, a saved running order, roles and accounts
When someone opens Cast, Running order, Casting Items, the Casting overview, the Production overview, Accounts and Usage
Then each shows its data as it does today

### AC2: Each list page's failure shows as today
Given the API fails when each list page asks for its main data
When someone opens that page
Then the page shows its usual error message

### AC3: No saved running order is not a failure
Given no running order has been saved yet
When someone opens Casting Items or the Production overview
Then the page says there's no saved running order yet and links to the Running order page, as today

### AC4: One way, everywhere
Given the web app
When the maintainer looks for how a page loads data from the API
Then every page uses the shared way, and none checks a response by hand

## Notes

- FRs: FR17
- Depends on: simplify.E4.S1 (and Epic 2, which moves the item pages)
- AC4 is checked at review (code-reviewer), not by a test.
- If the diff passes ~400 lines, split it by page, e.g. the Casting pages, then the rest.
