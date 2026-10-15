---
id: casting-items.E1.S2
title: Explain when there's no saved running order
epic: E1
status: ready
---

## Story

As a member of the production team, I want the Items page to tell me when there's no running order yet, so that I know to set one up instead of thinking the app is broken.

## Acceptance criteria

### AC1: No running order is explained, with a way to fix it
Given the production has no saved running order
When I open the Items page
Then I see "There's no saved running order yet."
And a link to the Running order page

### AC2: The link opens the Running order page
Given I see that there's no saved running order
When I choose the link to the Running order page
Then I see the "Running order" page heading

### AC3: A failed load is reported, not shown as empty
Given the running order can't be loaded because the API is unavailable
When I open the Items page
Then I see that the items couldn't be loaded
And I don't see "There's no saved running order yet."

## Notes

- FRs: FR6
- Depends on: casting-items.E1.S1.
- The running-order endpoint already answers 404 when there's no saved version. The page tells that apart from other failures (AC3).
