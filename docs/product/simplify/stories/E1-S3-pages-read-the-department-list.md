---
id: simplify.E1.S3
title: Take each department's name, permissions and wording from one list in the pages
epic: E1
status: done
---

## Story

As the maintainer, I want the pages to take each department's name, permissions and read-only wording from the one shared list, so that adding or changing a department is one entry, and its pages can't drift apart.

## Acceptance criteria

### AC1: The Overview's buttons are unchanged
Given "pat" has Tech but not Stage or Wardrobe
When pat opens the Production overview
Then each row's buttons are named, ordered and iconed as today: "Edit scenery for …", "View props for …", "Edit SFX for …", "Edit mic plot for …" and "View wardrobe for …"

### AC2: The read-only line is unchanged on every department page
Given "pat" has no permissions
When pat opens the Casting, Props, Scenery, SFX, Mic plot and Wardrobe pages for "Opening Number"
Then each shows today's line, e.g. "You can view the props, but not change them: only Stage, Director and admins can."
And the Scenery line still reads "only Stage, Tech, Director and admins can."

### AC3: The "wasn't saved" alert is unchanged for every department
Given "pat" had a department's page open before their access was removed
When pat saves a change and the API refuses it
Then the page says today's line for that department, e.g. "You can view the props but not change them, so this wasn't saved."

### AC4: Who may change a page is unchanged
Given "sam" has Director
When sam opens the Props, Scenery, SFX, Mic plot, Wardrobe and Casting item pages
Then sam can change every one but Casting, as today
And "pat", with Tech alone, can change the Scenery, SFX and Mic plot pages but not Props, Wardrobe or Casting

### AC5: The Overview's notes are unchanged
Given "Opening Number" has scenery, props, SFX, mic plot and wardrobe notes
When someone opens the Production overview
Then the notes show under the row headed "Scenery notes", "Props notes", "SFX notes", "Mic plot notes" and "Wardrobe notes", in that order

### AC6: The Wardrobe page names its files as the other pages do
Given "Opening Number" has no wardrobe files
When someone opens its Wardrobe page
Then it says "No wardrobe files for this item yet.", in lower case like "No scenery files for this item yet."

### AC7: A new department needs one entry
Given the shared list of departments
When the maintainer reads how a department's name, permissions and read-only line reach the pages
Then each is taken from the list, and no page states them again

## Notes

- FRs: FR2
- Depends on: simplify.E1.S2 (done)
- AC7 is checked at review (code-reviewer), not by a test.
- AC1 and AC5 restate today's behaviour; the Overview's existing tests cover them and must stay green through the change, so they have no red step of their own.
- Assumptions (made while the maintainer was away):
  - The shared list in `packages/shared` gains each department's name ("Mic plot") and its noun mid-sentence ("mic plot"), and whether it reads "it" or "them". The refusal line is built from these, worded exactly as before, so ADR 0035's "each department states its own refusal line" still holds without a new ADR.
  - The "who can change it" part of the read-only line is built from the department's permissions, in the order the Accounts page lists them (Casting, Stage, Tech, Wardrobe, Director), then "admins". That gives today's wording for every department, and doesn't depend on the order the permissions are listed in (ADR 0035).
  - The permission display names and the "A, B and C" helper move from the accounts utilities to the departments utilities, which accounts already reads.
  - A shared `mayChangeDepartment(access, department)` is the one "may change" check: the API's refusal check and the pages' `canChange(department)` both use it. The per-department `canChangeProps`-style computeds and the `*_PERMISSIONS` aliases go.
  - Each page's route name and icon stay in the web app's department pages list (they are presentation, not the API contract); the route name is the department id plus `-item`.
  - The Wardrobe empty-files line drops its capital (AC6) because the name now comes from the one noun; it was the only page saying "Wardrobe" mid-sentence.
- Also tidied from the E1.S2 review: the scenery refusal test asserts plainly; ADR 0029's refusal sentence is marked superseded by ADR 0035.
- Out of scope: Help and the Usage page (E1.S4); the "View only" badge (E3.S2).
