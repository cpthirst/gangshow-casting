---
id: simplify.E1.S2
title: Name each refusal after its route's department, not its first permission
epic: E1
status: done
---

## Story

As someone with view-only access to a department, I want a refused change to say which department I can't change, so that I know what I tried and who to ask, whichever way that department's permissions happen to be listed.

## Acceptance criteria

### AC1: The ADR comes first
Given ADR 0029 says a refusal uses the line of the first permission a route names
When this story starts
Then an ADR amending that clause, so each department states its own refusal line, is accepted by the maintainer before any code changes

### AC2: Each department's refusal is unchanged
Given "pat" has no permissions
When pat tries to change each department's data (casting, props, scenery, SFX, mic plot and wardrobe)
Then each refusal reads exactly as it does today, e.g. "You can view the SFX, but not change them." and "You can view the mic plot, but not change it."

### AC3: The refusal doesn't depend on permission order
Given the permissions that may change the scenery are listed in a different order
When "pat", with no permissions, tries to change the scenery notes
Then the refusal still reads "You can view the scenery, but not change it."

### AC4: Pages still recognise a read-only refusal
Given "pat" has a page open from before their access was removed
When pat saves a change and the API refuses it
Then the page shows its "wasn't saved" alert for that department, as it does today

### AC5: Recognising a refusal doesn't rely on its wording
Given a department's refusal line is reworded
When "pat" is refused a change to that department
Then the page still shows its "wasn't saved" alert

### AC6: Other failures aren't taken for a refusal
Given the API answers a save with a server error
When someone saves a change
Then the page shows its usual failure message, not the "wasn't saved" read-only alert

## Notes

- ADR: [0035](../../../adr/0035-each-department-states-its-own-refusal.md), amending ADR 0029
- FRs: FR2 (the shared list starts here, with each department's permissions and refusal line), FR3, FR4
- Depends on: none
- If FR4 needs the API to add a field to a refusal, adding one is allowed; every refusal's text stays the same (PRD non-goals).
- Out of scope: pages and Help reading the list (E1.S3, E1.S4).
