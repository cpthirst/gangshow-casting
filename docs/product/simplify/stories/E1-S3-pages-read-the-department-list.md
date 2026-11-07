---
id: simplify.E1.S3
title: Take each department's name, permissions and wording from one list in the pages
epic: E1
status: draft
---

## Story

As the maintainer, I want the pages to take each department's name, permissions and read-only wording from the one shared list, so that adding or changing a department is one entry, and its pages can't drift apart.

## Acceptance criteria

### AC1: The Overview's buttons are unchanged
Given "pat" has Tech but not Stage or Wardrobe
When pat opens the Production overview
Then each row's buttons are named, ordered and iconed as today: "View scenery for …", "View props for …", "Edit SFX for …", "Edit mic plot for …" and "View wardrobe for …"

### AC2: The read-only line is unchanged on every department page
Given "pat" has no permissions
When pat opens the Casting, Props, Scenery, SFX, Mic plot and Wardrobe pages for "Opening Number"
Then each shows today's line, e.g. "You can view the props, but not change them: only Stage, Director and admins can."

### AC3: Who may change a page is unchanged
Given "sam" has Director
When sam opens the Props, Scenery, SFX, Mic plot, Wardrobe and Casting item pages
Then sam can change every one but Casting, as today

### AC4: The Overview's notes are unchanged
Given "Opening Number" has props, scenery, SFX, mic plot and wardrobe notes
When someone opens the Production overview
Then the notes show under the row with today's headings, in today's order

### AC5: A new department needs one entry
Given the shared list of departments
When the maintainer reads how a department's name, permissions and read-only line reach the pages
Then each is taken from the list, and no page states them again

## Notes

- FRs: FR2
- Depends on: simplify.E1.S2
- AC5 is checked at review (code-reviewer), not by a test.
- Out of scope: Help and the Usage page (E1.S4); the "View only" badge (E3.S2).
